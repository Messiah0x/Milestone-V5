// ===== Wallet bridge ==========================================================
// The side panel runs in an extension page, not the web page, so it has no
// direct access to window.ethereum / window.solana. We inject a small,
// fully self-contained function into the active tab's MAIN world to talk to
// whatever wallet extension (MetaMask / Phantom / Backpack) is installed
// there, and read the return value back via chrome.scripting.executeScript.
//
// Functions passed as `func` to executeScript run in an isolated context and
// cannot close over anything in this file — they may only use their own
// arguments and globals available on the injected page (`window`, etc). When
// the injected function returns a Promise, executeScript awaits it and hands
// back the resolved value directly.

async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab to connect a wallet from.");
  return tab.id;
}

async function connectEvm() {
  const tabId = await getActiveTabId();

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: () => {
      if (!window.ethereum) return { error: "No EVM wallet (e.g. MetaMask) detected on this page." };
      return window.ethereum
        .request({ method: "eth_requestAccounts" })
        .then((accounts) => ({ result: { address: accounts[0] } }))
        .catch((err) => ({ error: err?.message || "Wallet connection was rejected." }));
    },
  });

  if (result?.error) throw new Error(result.error);
  return result.result.address;
}

async function signWithEvm(message) {
  const tabId = await getActiveTabId();
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    args: [message],
    func: (msg) => {
      return window.ethereum
        .request({ method: "eth_requestAccounts" })
        .then((accounts) =>
          window.ethereum
            .request({ method: "personal_sign", params: [msg, accounts[0]] })
            .then((signature) => ({ result: { signature } })),
        )
        .catch((err) => ({ error: err?.message || "Signing was rejected." }));
    },
  });
  if (result?.error) throw new Error(result.error);
  return result.result.signature;
}

async function connectSolana() {
  const tabId = await getActiveTabId();
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: () => {
      const provider = window.phantom?.solana || window.backpack || window.solana;
      if (!provider) return { error: "No Solana wallet (Phantom/Backpack) detected on this page." };
      return provider
        .connect()
        .then((resp) => ({ result: { address: (resp.publicKey || provider.publicKey).toString() } }))
        .catch((err) => ({ error: err?.message || "Wallet connection was rejected." }));
    },
  });
  if (result?.error) throw new Error(result.error);
  return result.result.address;
}

async function signWithSolana(message) {
  const tabId = await getActiveTabId();
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    args: [message],
    func: (msg) => {
      // Minimal, self-contained base58 encoder (Bitcoin alphabet) — the
      // extension's bs58 dependency lives server-side; this injected function
      // can't import anything, so it's reimplemented inline here.
      function base58Encode(bytes) {
        const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
        const digits = [0];
        for (let i = 0; i < bytes.length; i++) {
          let carry = bytes[i];
          for (let j = 0; j < digits.length; j++) {
            carry += digits[j] << 8;
            digits[j] = carry % 58;
            carry = (carry / 58) | 0;
          }
          while (carry > 0) {
            digits.push(carry % 58);
            carry = (carry / 58) | 0;
          }
        }
        let zeros = 0;
        for (let i = 0; i < bytes.length && bytes[i] === 0; i++) zeros++;
        return ALPHABET[0].repeat(zeros) + digits.reverse().map((d) => ALPHABET[d]).join("");
      }

      const provider = window.phantom?.solana || window.backpack || window.solana;
      if (!provider) return { error: "No Solana wallet detected on this page." };

      return provider
        .connect()
        .then(() => {
          const encoded = new TextEncoder().encode(msg);
          return provider.signMessage(encoded, "utf8");
        })
        .then((signed) => {
          const sigBytes = signed.signature || signed; // Phantom returns {signature}, some return raw bytes
          return { result: { signature: base58Encode(new Uint8Array(sigBytes)) } };
        })
        .catch((err) => ({ error: err?.message || "Signing was rejected." }));
    },
  });
  if (result?.error) throw new Error(result.error);
  return result.result.signature;
}

const Wallet = { connectEvm, signWithEvm, connectSolana, signWithSolana };

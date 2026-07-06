import { app } from "./app";
import { env } from "./env";

app.listen(Number(env.PORT), () => {
  console.log(`Milestone API listening on http://localhost:${env.PORT}`);
});

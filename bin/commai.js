#!/usr/bin/env node

import { main } from "../src/cli.js";
import chalk from "chalk";

main().catch((err) => {
  console.error(chalk.red("Erreur inattendue : ") + err.message);
  process.exit(1);
});

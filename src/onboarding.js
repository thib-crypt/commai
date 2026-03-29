import chalk from "chalk";
import boxen from "boxen";
import inquirer from "inquirer";
import { t } from "./i18n.js";
import { colors } from "./ui.js";

async function showSlide(title, text, isLast = false) {
  console.clear();
  console.log("\n");
  console.log(
    boxen(chalk.white(text), {
      title: chalk.bold.hex(colors.primary)(` ${title} `),
      titleAlignment: "center",
      padding: 2,
      margin: 1,
      borderColor: colors.primary,
      borderStyle: "round",
      width: 70,
    })
  );

  await inquirer.prompt([
    {
      type: "input",
      name: "continue",
      message: isLast ? chalk.green(t("onboarding.finish")) : chalk.cyan(t("onboarding.pressEnter")),
      prefix: "",
    },
  ]);
}

export async function runOnboarding() {
  const slides = [
    { title: t("onboarding.slide1Title"), text: t("onboarding.slide1Text") },
    { title: t("onboarding.slide2Title"), text: t("onboarding.slide2Text") },
    { title: t("onboarding.slide3Title"), text: t("onboarding.slide3Text") },
    { title: t("onboarding.slide4Title"), text: t("onboarding.slide4Text") },
    { title: t("onboarding.slide5Title"), text: t("onboarding.slide5Text") },
  ];

  for (let i = 0; i < slides.length; i++) {
    await showSlide(slides[i].title, slides[i].text, i === slides.length - 1);
  }

  console.clear();
}

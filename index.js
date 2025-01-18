import lighthouse from 'lighthouse';
import * as ChromeLauncher from 'chrome-launcher';
import OpenAI from 'openai';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { configDotenv } from 'dotenv';
import { zodResponseFormat } from 'openai/helpers/zod.mjs';

configDotenv();


const app = express();
app.use(cors())
app.use(bodyParser.json({ limit: "10mb" }));
app.use('/screenshots', express.static(path.join('screenshots')));

// Save screenshot and send to ChatGPT
app.post("/analyze", async (req, res) => {
  const { screenshot, url } = req.body;


  if (!screenshot) {
    return res.status(400).json({ result: "No screenshot received." });
  }

  try {
    // Decode base64 image
    const base64Data = screenshot.replace(/^data:image\/png;base64,/, "");
    const filename = `screenshot-${Date.now()}.png`;
    const filePath = path.join("screenshots", filename);

    // Ensure the screenshots directory exists
    if (!fs.existsSync(path.join("screenshots"))) {
      fs.mkdirSync(path.join("screenshots"));
    }

    // Save the image file
    fs.writeFileSync(filePath, base64Data, "base64");

    console.log("Screenshot saved:", filePath);

    const lighthouseReport = await runLighthouse(url);
    const prompt = `
    Analyze the attached image of a web application. Identify areas for improvement in terms of UI/UX design and functionality. Focus on:
        1. Layout and spacing.
        2. Font choices and readability.
        3. Consistency in design elements.
        4. Accessibility features.
        5. Any potential usability issues.
        6. Grammar issues.
        7. Any other UI/UX improvements you can suggest.
        8. Inconsistent Design Elements
        9. Poor Navigation Structure
        10. Cluttered Interface
        11. Slow Loading Times
        12. Lack of Mobile Responsiveness
        13. Unintuitive User Flows
        14. Low Contrast for Text and Backgrounds
        15. Missing Accessibility Features
        16. Confusing or Ambiguous Call-to-Actions
        17. Overwhelming Amount of Information
        18. Insufficient Feedback for User Actions
        19. Complex Onboarding Process
        20. Unclear Error Messages
        21. Inconsistent Typography
        22. Hidden Features or Options
        23. Lack of Visual Hierarchy
        24. Non-Standard Interactions or Patterns
        25. Unresponsive or Buggy UI Components
        26. Irrelevant or Low-Quality Content
        27. Poorly Designed Search Functionality


        Analyze the attached image of a web application.

        Focus on:
        1. Layout and spacing.
        2. Font choices and readability.
        3. Consistency in design elements.
        4. Accessibility features (aiming for WCAG AA compliance).
        5. Usability issues, particularly with navigation and data interaction.
        6. Grammar issues in content.

        Key Metrics: Users report difficulty locating data due to unclear navigation and cluttered visuals. Bounce rate is currently at 60%, with session durations averaging under 1 minute.

        Provide actionable issues and suggestions for each identified context.

        Here is Lighthouse report which will help you to generate more insights.
        ${lighthouseReport}
    `;

    const result = await sendRequestToChatGPT(filename, prompt);
    console.log('ChatGPT Response:', result);
    // Respond to the extension with the ChatGPT analysis

    res.json(result);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ result: "Failed to process image or analyze." });
  }
});

app.listen(process.env.PORT, () => {
  console.log("Server running on " + process.env.HOST);
});



async function sendRequestToChatGPT(filePath, prompt) {
  try {
    const host = process.env.HOST;
    const responseFormat = z.object({
      ui_ux: z.array(
        z.object({
          title: z.string(),
          problems: z.array(z.object({ issue: z.string(), suggestion: z.string(), priority: z.enum(["low", "medium", "high"]) })),
        }),
      ),
      spelling_issues: z.array(
        z.object({
          word: z.string(),
          location: z.string(),
          suggestions: z.array(z.string()),
        }),
      ),
    })

    const openai = new OpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
          {
              role: "user",
              content: [
                  { type: "text", text: prompt },
                  {
                      type: "image_url",
                      image_url: {
                          "url": `${host}screenshots/${filePath}`,
                      },
                  }
              ],
          },
      ],
      response_format: zodResponseFormat(responseFormat, "responseFormat")
    });

    
    return JSON.parse(completion.choices[0].message.content);

  } catch (error) {
    console.error('Error communicating with OpenAI API:', error.response?.data || error.message);
    throw error;
  }
}

async function runLighthouse(url) {
  const chrome = await ChromeLauncher.launch({
    startingUrl: url,
    chromePath: "/usr/bin/chromium",
    chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox',   '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-software-rasterizer',]
  })

  console.log(`Chrome debugging port running on ${chrome.port}`);
  const options = { logLevel: 'info', output: 'json', onlyCategories: ['performance', 'accessibility', 'seo'], port: chrome.port };
  const runnerResult = await lighthouse(url, options);

  await chrome.kill();

  return runnerResult.lhr.categories;
}
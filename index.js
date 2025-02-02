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
import axios from 'axios';

configDotenv();


const app = express();
app.use(cors())
app.use(bodyParser.json({ limit: "100mb" }));
app.use('/screenshots', express.static(path.join('screenshots')));

// Save screenshot and send to ChatGPT
app.post("/analyze", async (req, res) => {
  const { screenshots, url, focusOn, about } = req.body;


  if (!screenshots) {
    return res.status(400).json({ result: "No screenshots received." });
  }

  try {
    const screenshotsPaths = [];
    // Decode base64 image
    for (let i = 0; i < screenshots.length; i++) {
      const screenshot = screenshots[i].screenshot;
      const base64Data = screenshot.replace(/^data:image\/png;base64,/, "");
      const filename = `screenshot-${Date.now()}.png`;
      const filePath = path.join("screenshots", filename);
      
      // Ensure the screenshots directory exists
      if (!fs.existsSync(path.join("screenshots"))) {
        fs.mkdirSync(path.join("screenshots"));
      }

      // Save the image file
      fs.writeFileSync(filePath, base64Data, "base64");

      screenshotsPaths.push(filename);

      console.log("Screenshot saved:", filePath);
    }

    // const webpage = await fetchWebpage(url);
    // console.log('Webpage:', webpage);
    // const about = await whatAboutIsThisWebPage(webpage);
    // const lighthouseReport = await runLighthouse(url);
    const prompt = `
      Web Page is about ${about}.
      Analyze the attached image of a web application. Identify areas for improvement in terms of UI/UX design and functionality. Focus on:
        ${focusOn}

        Provide actionable issues and suggestions if there are for each identified context, if there aren't please don't give some boolshit, make sure that it will be valuale issues for QA engieners, we need to save their time, and please include solutions of the problem also if you can't give solution keep it empty and give suggestion.
        Please give me solutions and descritption for each issue very detailed.
    `;

    const result = await sendRequestToChatGPT(screenshotsPaths, prompt);
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



async function sendRequestToChatGPT(screenshots, prompt) {
  try {
    const host = process.env.HOST;
    const responseFormat = z.object({
      ui_ux: z.array(
        z.object({
          title: z.string(),
          problems: z.array(z.object({ issue: z.string(), solution: z.array(z.string()), description: z.string(), location: z.string(), infoLink: z.string(), suggestion: z.string(), priority: z.enum(["low", "medium", "high"]) })),
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
    
    const screenshotsData = screenshots.map((screenshot) => {
      return  {
        type: "image_url",
        image_url: {
            "url": `${host}screenshots/${screenshot}`,
        },
      }
    });
    const openai = new OpenAI();
    const messages = [
      {
          role: "user",
          content: [
              { type: "text", text: prompt },
              ...screenshotsData,
          ],
      },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages,
      response_format: zodResponseFormat(responseFormat, "responseFormat")
    });

    messages.push(completion.choices[0].message);

    messages.push({
      role: "user",
      content: [
        { type: "text", text: "Continue with other contexts" },
      ],
    })
    
    const nextContext = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages,
      response_format: zodResponseFormat(responseFormat, "responseFormat")
    });

    const firstContext = JSON.parse(completion.choices[0].message.content);
    const nextContextData = JSON.parse(nextContext.choices[0].message.content);
    const ui_ux = [
      ...firstContext.ui_ux,
      ...nextContextData.ui_ux,
    ];
    const spelling_issues = [
      ...firstContext.spelling_issues,
      ...nextContextData.spelling_issues];

    return { ui_ux, spelling_issues };

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

async function whatAboutIsThisWebPage(html) {
  const openai = new OpenAI();
  const prompt = `
  What is this web page about? Analyze the content and context of the web page and provide a brief summary.
  ${html}
  `;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
        ],
      },
    ]
  });

  return completion.choices[0].message.content;
}

async function fetchWebpage(url) {
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching webpage:', error.message);
  }
}
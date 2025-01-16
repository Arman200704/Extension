const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const { OpenAI } = require('openai');
const cors = require('cors');

const app = express();
app.use(cors())
app.use(bodyParser.json({ limit: "10mb" }));
app.use('/screenshots', express.static(path.join(__dirname, 'screenshots')));

// Save screenshot and send to ChatGPT
app.post("/analyze", async (req, res) => {
  const { screenshot } = req.body;

  if (!screenshot) {
    return res.status(400).json({ result: "No screenshot received." });
  }

  try {
    // Decode base64 image
    const base64Data = screenshot.replace(/^data:image\/png;base64,/, "");
    const filename = `screenshot-${Date.now()}.png`;
    const filePath = path.join(__dirname, "screenshots", filename);

    // Ensure the screenshots directory exists
    if (!fs.existsSync(path.join(__dirname, "screenshots"))) {
      fs.mkdirSync(path.join(__dirname, "screenshots"));
    }

    // Save the image file
    fs.writeFileSync(filePath, base64Data, "base64");

    console.log("Screenshot saved:", filePath);

  const prompt = `
   Analyze the attached image of a web application. Identify areas for improvement in terms of UI/UX design and functionality. Focus on:
      1. Layout and spacing.
      2. Font choices and readability.
      3. Consistency in design elements.
      4. Accessibility features.
      5. Any potential usability issues.
      6. Grammar issues.
      7. Any other UI/UX improvements you can suggest.

    Provide actionable suggestions for each identified issue.
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


// const openaiApiKey = process.env.OPENAI_API_KEY; // Replace with your OpenAI API key

const host = process.env.HOST;
async function sendRequestToChatGPT(filePath, prompt) {
  try {
    // Read the file content

    // Combine the file content with the prompt
    // console.log(fileContent)
    // const fullPrompt = `${prompt}\n\nFile Content:\n${fileContent}`;
    const openai = new OpenAI();
    console.log(host + "screenshots/" + filePath);
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
                          "url": host + "screenshots/" + filePath,
                      },
                  }
              ],
          },
      ],
  });
  
  return completion.choices[0].message;

  } catch (error) {
    console.error('Error communicating with OpenAI API:', error.response?.data || error.message);
    throw error;
  }
}
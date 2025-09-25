import { GoogleGenAI, Modality } from "@google/genai";
import * as fs from "node:fs";

async function main() {
  const ai = new GoogleGenAI({
    apiKey: "sk-xxxxxx",
    httpOptions: {
        baseUrl: "https://api.joyzhi.com"
    }
  });

  const imagePath1 = "cat.jpg";
  const imageData1 = fs.readFileSync(imagePath1);
  const base64Image1 = imageData1.toString("base64");

  const prompt = [
    {
      text:
        "Create a picture of my cat eating a nano-banana in a" +
        "fancy restaurant under the Gemini constellation",
    },
    {
      inlineData: {
        mimeType: "image/png",
        data: base64Image1,
      },
    },
  ];

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image-preview",
    contents: prompt,
  });

  const parts = response.candidates?.[0]?.content?.parts;
  
  if (parts) {
    for (const part of parts) {
      if (part.text) {
        console.log(part.text);
      } else if (part.inlineData && part.inlineData.data) {
        const imageData = part.inlineData.data;
        const buffer = Buffer.from(imageData, "base64");
        fs.writeFileSync("gemini-native-image.png", buffer);
        console.log("Image saved as gemini-native-image.png");
        }
    }
  } else {
    console.error("No valid response parts found");
  }
}

main();
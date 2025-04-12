# Setting Up Google's Gemini API for Resume Tag Generation

This guide will walk you through how to set up and use Google's Gemini API to generate tags from resume documents.

## 1. Get API Key from Google AI Studio

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Sign in with your Google account
3. Click on "Get API key" in the top right corner
4. Create a new API key or use an existing one
5. Save your API key securely - you'll need it later

## 2. Set Up a Simple Backend Server

You need a backend server to safely use your API key. Here's how to set one up using Node.js and Express:

### Create a new directory for your server:

```bash
mkdir gemini-api-server
cd gemini-api-server
npm init -y
npm install express dotenv cors multer @google/generative-ai
```

### Create a `.env` file:

```
GEMINI_API_KEY=your_api_key_here
PORT=3000
```

### Create a server.js file:

```javascript
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Configure multer for file uploads
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Helper function to convert file to base64
function fileToGenerativePart(filePath, mimeType) {
  const fileData = fs.readFileSync(filePath);
  return {
    inlineData: {
      data: fileData.toString('base64'),
      mimeType
    }
  };
}

// Helper function to extract text from PDF files
async function extractTextFromPDF(filePath) {
  // This is a simplified example - in a real implementation
  // you'd want to use a library like pdf-parse
  // For this example, we're using Gemini's ability to process PDFs directly
  
  return fileToGenerativePart(filePath, 'application/pdf');
}

// Route to generate tags from resume
app.post('/generate-tags', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const prompt = req.body.prompt || 'Extract professional skills and keywords from this resume. Return as a JSON array of strings.';
    const filePath = req.file.path;
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    
    // Select the appropriate model
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    
    let content;
    let result;
    
    if (fileExt === '.pdf') {
      // For PDFs, use Gemini's ability to process PDFs directly
      content = fileToGenerativePart(filePath, 'application/pdf');
      result = await model.generateContent([prompt, content]);
    } else if (fileExt === '.doc' || fileExt === '.docx') {
      // For Word docs, you might want to extract text first using a library
      // In this simplified example, we'll ask Gemini to do its best with the binary
      content = fileToGenerativePart(filePath, 
        fileExt === '.doc' ? 'application/msword' : 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      result = await model.generateContent([prompt, content]);
    } else {
      return res.status(400).json({ error: 'Unsupported file format' });
    }
    
    const responseText = result.response.text();
    
    // Try to parse response as JSON, if not, convert text to tags
    let tags;
    try {
      // If the model returns JSON directly
      tags = JSON.parse(responseText);
    } catch (e) {
      // If not, attempt to extract tags from text
      const lines = responseText.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('#') && !line.startsWith('-'));
      
      tags = lines.map(line => {
        // Remove common prefixes/bullets and clean up
        return line.replace(/^[•\-\*\[\]\d\.]+\s*/g, '').trim();
      }).filter(tag => tag.length > 0);
    }
    
    // Clean up uploaded file
    fs.unlinkSync(filePath);
    
    res.json({ tags });
  } catch (error) {
    console.error('Error processing resume:', error);
    res.status(500).json({ error: 'Failed to process resume', details: error.message });
  }
});

app.listen(port, () => {
  console.log(`Gemini API server running on port ${port}`);
});
```

## 3. Run the Server

```bash
node server.js
```

Your server should now be running on port 3000 (or the port you specified in your .env file).

## 4. Update Your Frontend Code

Update the `generateTagsWithGemini` function in your `SignUpScreen.js` file:

```javascript
const generateTagsWithGemini = async (file) => {
  try {
    // Create form data to send the file
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType
    });
    formData.append('prompt', 'Extract 5-10 professional skills and keywords from this resume. Return as a JSON array of strings.');
    
    // Replace with your actual server URL
    const response = await fetch('http://your-server-address:3000/generate-tags', {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to generate tags');
    }
    
    const data = await response.json();
    return data.tags;
    
  } catch (error) {
    console.error('Error generating tags:', error);
    // Fallback to default tags if API fails
    return ['professional', 'resume', 'candidate', 'skills'];
  }
};
```

## 5. Deploy Your Server

For a production environment, you should deploy this server to a hosting platform like:

- Heroku
- Google Cloud Run
- AWS Lambda
- Vercel

Remember to set the `GEMINI_API_KEY` environment variable on your hosting platform.

## 6. Security Considerations

- Never expose your Gemini API key in your mobile app
- Implement rate limiting on your server
- Add authentication to your API endpoints
- Consider adding HTTPS
- Validate file types and sizes server-side

## 7. Testing

You can test your API endpoint using tools like Postman or cURL:

```bash
curl -X POST -F "file=@/path/to/resume.pdf" -F "prompt=Extract skills from this resume" http://localhost:3000/generate-tags
```

The response should be a JSON object containing an array of tags extracted from the resume.

## Troubleshooting

- If you get CORS errors, ensure your server is properly configured for CORS
- Check for file size limits in both your server and the Gemini API
- Verify that your API key has the necessary permissions
- Confirm that the file formats you're using are supported by the Gemini API 
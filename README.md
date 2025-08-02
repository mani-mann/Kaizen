# AI Ad Generation Tool

A modern web application that uses AI to generate comprehensive marketing plans and content creation prompts based on your brand information.

## Features

- **Brand Information Collection**: Upload your brand logo, specify brand colors, and provide your brand story
- **Product Details**: Describe your product/service and target audience
- **Marketing Asset Selection**: Choose from various marketing asset types (landing pages, social media posts, ads, etc.)
- **AI-Powered Recommendations**: Get platform recommendations and detailed strategies
- **Content Creation Prompts**: Receive specific AI prompts for tools like ChatGPT, Midjourney, DALL-E, etc.
- **Modern UI**: Beautiful, responsive interface built with React and Tailwind CSS

## Tech Stack

- **Frontend**: React 18 with TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **HTTP Client**: Axios
- **AI Integration**: Perplexity API (Sonar model)

## Setup Instructions

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn package manager

### Installation

1. **Clone or download the project files**

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm start
   ```

4. **Open your browser** and navigate to `http://localhost:3000`

## Usage

1. **Upload Your Brand Logo**: Click the upload area to add your brand logo (supports PNG, JPG, SVG)

2. **Enter Brand Colors**: Specify your brand colors in hex format (e.g., Primary: #3B82F6, Secondary: #10B981)

3. **Tell Your Brand Story**: Describe your brand's mission, values, and what makes you unique

4. **Add Product Details**: Provide information about your product/service, features, benefits, and target audience

5. **Select Marketing Asset Type**: Choose from options like landing page, Instagram reel, Facebook ad, etc.

6. **Specify Asset Details**: Describe the tone, style, and specific requirements for your asset

7. **Generate Plan**: Click "Generate Marketing Plan" to get AI-powered recommendations

## API Configuration

The application uses the Perplexity API with the Sonar model. The API key is already configured in the code. If you need to use your own API key, update it in `src/services/perplexityApi.ts`.

## Output

The tool generates:

- **Recommended Platforms**: Based on your asset type and target audience
- **Detailed Strategy**: Step-by-step implementation plan
- **AI Prompts**: Specific prompts for content creation tools

## Available Marketing Asset Types

- Landing Page
- Instagram Reel
- Facebook Ad
- Google Ad
- Email Campaign
- Social Media Post
- Video Ad
- Banner Ad

## File Structure

```
src/
├── App.tsx                 # Main application component
├── index.tsx              # React entry point
├── index.css              # Global styles with Tailwind
└── services/
    └── perplexityApi.ts   # API integration service
```

## Customization

- **Styling**: Modify `tailwind.config.js` to customize colors and theme
- **API Integration**: Update `src/services/perplexityApi.ts` to modify AI prompts or API settings
- **Form Fields**: Add or modify form fields in `src/App.tsx`

## Troubleshooting

- **Port conflicts**: If port 3000 is in use, the app will automatically use the next available port
- **API errors**: Check your internet connection and ensure the Perplexity API key is valid
- **Build issues**: Run `npm install` to ensure all dependencies are properly installed

## License

This project is open source and available under the MIT License. 
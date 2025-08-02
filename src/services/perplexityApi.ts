import axios from 'axios';

interface FormData {
  brandLogo: File | null;
  brandColors: string;
  brandStory: string;
  productDetails: string;
  marketingAsset: string;
  assetDetails: string;
}

interface GeneratedPlan {
  platforms: string[];
  detailedPlan: string;
  prompts: string[];
}

const PERPLEXITY_API_KEY = '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';
const API_URL = 'https://api.perplexity.ai/chat/completions';

export const generateAdPlan = async (formData: FormData): Promise<GeneratedPlan> => {
  const prompt = buildPrompt(formData);
  
  try {
    const response = await axios.post(API_URL, {
      model: 'sonar-medium-online',
      messages: [
        {
          role: 'system',
          content: 'You are an expert marketing strategist and AI content creator. Your task is to analyze brand information and create detailed marketing plans with specific AI prompts for content creation.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.7,
      stream: false
    }, {
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    const aiResponse = response.data.choices[0].message.content;
    return parseAIResponse(aiResponse);
  } catch (error: any) {
    console.error('Perplexity API error:', error);
    if (error.response) {
      console.error('API Response Error:', error.response.data);
    }
    
    // Return a fallback response for testing purposes
    console.log('Using fallback response due to API error');
    return getFallbackResponse(formData);
  }
};

const buildPrompt = (formData: FormData): string => {
  return `
As an expert marketing strategist, analyze the following brand information and create a comprehensive marketing plan:

BRAND INFORMATION:
- Brand Colors: ${formData.brandColors}
- Brand Story: ${formData.brandStory}
- Product Details: ${formData.productDetails}
- Marketing Asset Type: ${formData.marketingAsset}
- Asset Details & Tone: ${formData.assetDetails}

Please provide a detailed response in the following JSON format:

{
  "platforms": ["platform1", "platform2", "platform3"],
  "detailedPlan": "Comprehensive strategy including platform recommendations, content approach, and implementation steps",
  "prompts": [
    "Specific AI prompt for content creation tool 1",
    "Specific AI prompt for content creation tool 2",
    "Specific AI prompt for content creation tool 3"
  ]
}

Focus on:
1. Recommended platforms based on the asset type and target audience
2. Detailed strategy with step-by-step implementation
3. Specific AI prompts that can be used with tools like ChatGPT, Midjourney, DALL-E, or other AI content creation tools
4. Consider the brand's tone, colors, and story in all recommendations

Make the response practical and actionable.
`;
};

const parseAIResponse = (response: string): GeneratedPlan => {
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        platforms: parsed.platforms || [],
        detailedPlan: parsed.detailedPlan || response,
        prompts: parsed.prompts || []
      };
    }
    
    // Fallback: parse the response manually
    return {
      platforms: extractPlatforms(response),
      detailedPlan: response,
      prompts: extractPrompts(response)
    };
  } catch (error) {
    console.error('Error parsing AI response:', error);
    return {
      platforms: ['Multiple platforms'],
      detailedPlan: response,
      prompts: ['Use the detailed plan above to create your content']
    };
  }
};

const extractPlatforms = (response: string): string[] => {
  const platformKeywords = [
    'Instagram', 'Facebook', 'Google', 'TikTok', 'LinkedIn', 'Twitter', 'YouTube',
    'Pinterest', 'Snapchat', 'Email', 'Website', 'Landing Page', 'Blog'
  ];
  
  return platformKeywords.filter(platform => 
    response.toLowerCase().includes(platform.toLowerCase())
  );
};

const extractPrompts = (response: string): string[] => {
  const promptKeywords = ['prompt:', 'ai prompt:', 'create:', 'generate:'];
  const lines = response.split('\n');
  const prompts: string[] = [];
  
  lines.forEach(line => {
    promptKeywords.forEach(keyword => {
      if (line.toLowerCase().includes(keyword.toLowerCase())) {
        const prompt = line.substring(line.toLowerCase().indexOf(keyword.toLowerCase()) + keyword.length).trim();
        if (prompt) prompts.push(prompt);
      }
    });
  });
  
  return prompts.length > 0 ? prompts : ['Use the detailed strategy above to create compelling content for your chosen platforms'];
};

const getFallbackResponse = (formData: FormData): GeneratedPlan => {
  const assetType = formData.marketingAsset.toLowerCase();
  let platforms: string[] = [];
  let detailedPlan = '';
  let prompts: string[] = [];

  if (assetType.includes('instagram') || assetType.includes('reel')) {
    platforms = ['Instagram', 'TikTok', 'Facebook'];
    detailedPlan = `For your ${formData.marketingAsset}, focus on creating visually appealing content that aligns with your brand colors (${formData.brandColors}). 

Key Strategy:
1. Create engaging visual content that showcases your product/service
2. Use your brand story to create authentic, relatable content
3. Leverage trending hashtags and current events
4. Post consistently and engage with your audience
5. Use Instagram Stories and Reels for maximum reach

Implementation Steps:
- Design content calendar with 3-5 posts per week
- Create both static and video content
- Use your brand colors consistently across all posts
- Include clear call-to-actions in each post
- Monitor engagement and adjust strategy based on performance`;
    
    prompts = [
      `Create an Instagram reel script for ${formData.productDetails} with a ${formData.assetDetails} tone. Include hooks, main content, and call-to-action.`,
      `Design a social media post for ${formData.productDetails} using brand colors ${formData.brandColors} with ${formData.assetDetails} tone.`,
      `Generate 5 hashtag suggestions for ${formData.productDetails} that align with ${formData.brandStory}`
    ];
  } else if (assetType.includes('landing')) {
    platforms = ['Website', 'Google Ads', 'Facebook Ads'];
    detailedPlan = `For your landing page, create a conversion-focused experience that tells your brand story effectively.

Key Strategy:
1. Design a compelling hero section with clear value proposition
2. Use your brand colors to create visual hierarchy
3. Include social proof and testimonials
4. Create multiple conversion points
5. Optimize for mobile and desktop

Implementation Steps:
- Create wireframes and mockups
- Write compelling copy that addresses pain points
- Design forms and lead capture mechanisms
- Set up analytics and tracking
- A/B test different elements for optimization`;
    
    prompts = [
      `Write a compelling landing page headline for ${formData.productDetails} with ${formData.assetDetails} tone.`,
      `Create a landing page copy structure for ${formData.productDetails} that incorporates ${formData.brandStory}.`,
      `Design a call-to-action button for ${formData.productDetails} using brand colors ${formData.brandColors}.`
    ];
  } else {
    platforms = ['Multiple Platforms', 'Social Media', 'Digital Ads'];
    detailedPlan = `Based on your ${formData.marketingAsset} requirements, here's a comprehensive marketing strategy:

Brand Integration:
- Use your brand colors (${formData.brandColors}) consistently across all assets
- Incorporate your brand story: ${formData.brandStory}
- Maintain ${formData.assetDetails} tone throughout all content

Content Strategy:
- Create content that resonates with your target audience
- Focus on value-driven messaging
- Include clear calls-to-action
- Measure and optimize performance

Implementation:
- Develop content calendar
- Create multiple asset variations
- Set up tracking and analytics
- Monitor and adjust based on performance data`;
    
    prompts = [
      `Create a marketing copy for ${formData.productDetails} with ${formData.assetDetails} tone.`,
      `Design a visual concept for ${formData.productDetails} using brand colors ${formData.brandColors}.`,
      `Write a compelling headline for ${formData.productDetails} that reflects ${formData.brandStory}.`
    ];
  }

  return {
    platforms,
    detailedPlan,
    prompts
  };
}; 
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const envPath = path.join(__dirname, '.env');
dotenv.config({ path: envPath });
const envExists = fs.existsSync(envPath);
let envFallbackApplied = false;
let envFallbackSource = null;
let keyFileTried = false;
let keyFilePath = path.join(__dirname, 'api_key.txt');
let keyFileAltPath = path.join(__dirname, 'public', 'api_key.txt');
const keyFileExistsRoot = fs.existsSync(keyFilePath);
const keyFileExistsPublic = fs.existsSync(keyFileAltPath);

// Fallback loader: handle BOM/quotes/whitespace issues in .env
try {
    if (!process.env.GEMINI_API_KEY && envExists) {
        // Parse using dotenv.parse for robustness
        try {
            const parsed = dotenv.parse(fs.readFileSync(envPath));
            const candidates = [
                parsed.GEMINI_API_KEY,
                parsed.GOOGLE_API_KEY,
                parsed.API_KEY
            ].filter(Boolean);
            const value = candidates[0];
            if (value && String(value).trim()) {
                process.env.GEMINI_API_KEY = String(value).trim();
                envFallbackApplied = true;
                envFallbackSource = parsed.GEMINI_API_KEY ? 'GEMINI_API_KEY' : (parsed.GOOGLE_API_KEY ? 'GOOGLE_API_KEY' : 'API_KEY');
            }
        } catch (_) { /* ignore and try binary scan below */ }

        // If still not set, perform a binary-safe scan (handles UTF-16/NULL bytes)
        if (!process.env.GEMINI_API_KEY) {
            const buf = fs.readFileSync(envPath);
            let text = buf.toString('utf8');
            // Remove NULL bytes that appear in UTF-16 when decoded as UTF-8
            if (text.indexOf('\u0000') !== -1) {
                text = buf.toString('ucs2');
            }
            text = text.replace(/^\uFEFF/, ''); // strip BOM
            text = text.replace(/\u0000/g, '');
            const match = text.match(/(^|\n|\r)\s*(GEMINI_API_KEY|GOOGLE_API_KEY|API_KEY)\s*=\s*([^\r\n]+)/);
            if (match) {
                let value = match[3].trim();
                value = value.replace(/^\"|^\'|\"$|\'$/g, '');
                if (value) {
                    process.env.GEMINI_API_KEY = value;
                    envFallbackApplied = true;
                    envFallbackSource = match[2];
                }
            }

            // Last resort: look for a Google-style key token in the file
            if (!process.env.GEMINI_API_KEY) {
                const token = text.match(/AIza[0-9A-Za-z_\-]{20,}/);
                if (token && token[0]) {
                    process.env.GEMINI_API_KEY = token[0];
                    envFallbackApplied = true;
                    envFallbackSource = 'pattern:AIza*';
                }
            }
        }
    }
} catch (e) {
    // ignore; diagnostics will show missing if still not set
}

// Final fallback: read plain key from api_key.txt (project root or public/)
try {
    const candidatePaths = [keyFilePath, keyFileAltPath];
    for (const p of candidatePaths) {
        if (!process.env.GEMINI_API_KEY && fs.existsSync(p)) {
            keyFileTried = true;
            let k = fs.readFileSync(p, 'utf8');
            k = String(k).trim();
            // strip quotes and obvious separators accidentally pasted
            k = k.replace(/["'`\s]/g, '');
            if (k) {
                process.env.GEMINI_API_KEY = k;
                envFallbackApplied = true;
                envFallbackSource = `file:${path.basename(p)}`;
                keyFilePath = p; // record the actual used path
            }
        }
    }
} catch (_) { /* ignore */ }

// Normalize: if we have a key from any source, set all env var names
const unifyKeyIfPresent = () => {
    const k = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY || null;
    if (k) {
        process.env.GEMINI_API_KEY = k;
        process.env.GOOGLE_API_KEY = k;
        process.env.API_KEY = k;
    }
};
unifyKeyIfPresent();

const app = express();
const PORT = process.env.PORT || 3000;

// Movie poster fetching function - using OMDB API for real movie posters
async function getMoviePoster(title, year) {
    try {
        // Use OMDB API to get real movie posters
        const OMDB_API_KEY = 'trilogy'; // Free API key for basic usage
        const searchTitle = encodeURIComponent(title);
        const searchYear = year ? `&y=${year}` : '';
        
        const omdbUrl = `https://www.omdbapi.com/?t=${searchTitle}${searchYear}&apikey=${OMDB_API_KEY}`;
        
        console.log(`Fetching real movie poster for: ${title}`);
        const response = await fetch(omdbUrl);
        const data = await response.json();
        
        if (data.Poster && data.Poster !== 'N/A') {
            console.log(`Found real poster for ${title}: ${data.Poster}`);
            return data.Poster;
        }
        
        // If no poster found, create a movie-themed placeholder
        const cleanTitle = title.replace(/[^a-zA-Z0-9\s]/g, '').trim().substring(0, 20);
        const placeholderUrl = `data:image/svg+xml;base64,${Buffer.from(`
            <svg width="300" height="450" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
                    </linearGradient>
                </defs>
                <rect width="300" height="450" fill="url(#bg)"/>
                <text x="150" y="200" font-family="Arial, sans-serif" font-size="24" font-weight="bold" text-anchor="middle" fill="white">${cleanTitle}</text>
                <text x="150" y="250" font-family="Arial, sans-serif" font-size="16" text-anchor="middle" fill="white" opacity="0.8">Movie Poster</text>
            </svg>
        `).toString('base64')}`;
        
        console.log(`No real poster found for ${title}, using placeholder`);
        return placeholderUrl;
        
    } catch (error) {
        console.log('Poster fetch error:', error.message);
        // Fallback to movie-themed placeholder
        const cleanTitle = title.replace(/[^a-zA-Z0-9\s]/g, '').trim().substring(0, 20);
        return `data:image/svg+xml;base64,${Buffer.from(`
            <svg width="300" height="450" xmlns="http://www.w3.org/2000/svg">
                <rect width="300" height="450" fill="#667eea"/>
                <text x="150" y="225" font-family="Arial, sans-serif" font-size="20" text-anchor="middle" fill="white">${cleanTitle}</text>
            </svg>
        `).toString('base64')}`;
    }
}

function getEffectiveKey() {
    return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY || null;
}

function getKeySource() {
    if (envFallbackSource) return envFallbackSource;
    if (process.env.GEMINI_API_KEY) return 'GEMINI_API_KEY';
    if (process.env.GOOGLE_API_KEY) return 'GOOGLE_API_KEY';
    if (process.env.API_KEY) return 'API_KEY';
    return null;
}

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files with cache-busting
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, path) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
}));

// Serve the main HTML file from public/
app.get('/', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve the results page
app.get('/result', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(__dirname, 'public', 'result.html'));
});

// Movie recommendation endpoint
app.post('/api/recommend', async (req, res) => {
    try {
        const { movie1, movie2, movie3, genres } = req.body;

        // Validate input: allow 1-3 movie titles
        if (!movie1 || !movie1.trim()) {
            return res.status(400).json({ 
                error: 'Please provide at least one movie'
            });
        }

        const m1 = movie1.trim().toLowerCase();
        const m2 = movie2 && movie2.trim() ? movie2.trim().toLowerCase() : null;
        const m3 = movie3 && movie3.trim() ? movie3.trim().toLowerCase() : null;

        if (m2 && m1 === m2) {
            return res.status(400).json({ 
                error: 'Please provide two different movies' 
            });
        }
        if (m3 && (m3 === m1 || (m2 && m3 === m2))) {
            return res.status(400).json({
                error: 'Duplicate movies detected; please provide different titles'
            });
        }

        // Check for Gemini/Google API key
        const EFFECTIVE_API_KEY = getEffectiveKey();
        if (!EFFECTIVE_API_KEY) {
            return res.status(500).json({ 
                error: 'Gemini API key not configured. Please set GEMINI_API_KEY (or GOOGLE_API_KEY / API_KEY) in .env' 
            });
        }

        const first = movie1.trim();
        const second = movie2 && movie2.trim() ? movie2.trim() : null;
        const third = movie3 && movie3.trim() ? movie3.trim() : null;

        console.log(`Getting recommendation for: ${[first, second, third].filter(Boolean).map(s=>`"${s}"`).join(' and ')}`);

        // Call Gemini API to get both recommendation and detected genres
        const result = await getMovieRecommendation(first, second, third);
        
            // Get input movie details with real movie posters
            const inputMovieDetails = await Promise.all(
                [first, second, third].filter(Boolean).map(async (movie) => {
                    try {
                        const poster = await getMoviePoster(movie, '');
                        return { 
                            poster: poster || `data:image/svg+xml;base64,${Buffer.from(`
                                <svg width="300" height="450" xmlns="http://www.w3.org/2000/svg">
                                    <rect width="300" height="450" fill="#667eea"/>
                                    <text x="150" y="225" font-family="Arial, sans-serif" font-size="20" text-anchor="middle" fill="white">${movie}</text>
                                </svg>
                            `).toString('base64')}`,
                            year: 'Your Choice',
                            genre: 'Amazing Pick!'
                        };
                    } catch (error) {
                        return { 
                            poster: `data:image/svg+xml;base64,${Buffer.from(`
                                <svg width="300" height="450" xmlns="http://www.w3.org/2000/svg">
                                    <rect width="300" height="450" fill="#667eea"/>
                                    <text x="150" y="225" font-family="Arial, sans-serif" font-size="20" text-anchor="middle" fill="white">${movie}</text>
                                </svg>
                            `).toString('base64')}`,
                            year: 'Your Choice',
                            genre: 'Amazing Pick!'
                        };
                    }
                })
            );
        
        res.json({ 
            movie: result.movie,
            inputMovies: [first, second, third].filter(Boolean),
            inputMovieDetails: inputMovieDetails,
            usedGenres: result.detectedGenres || []
        });

    } catch (error) {
        console.error('Error in /api/recommend:', error);
        res.status(500).json({ 
            error: error.message || 'Failed to get movie recommendation' 
        });
    }
});

async function getMovieRecommendation(movie1, movie2, movie3) {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    
    const EFFECTIVE_API_KEY = getEffectiveKey();
    const genAI = new GoogleGenerativeAI(EFFECTIVE_API_KEY);
    const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-flash-lite" });

    const baseJsonSpec = `
Please respond ONLY with a valid JSON object in this exact format (no additional text, explanations, or markdown):

{
  "title": "Movie Title",
  "year": "Release Year",
  "genre": "Main genres (comma separated)",
  "director": "Director name(s)",
  "cast": "Main cast members (comma separated, max 4 actors)",
  "rating": "IMDb rating (number out of 10, like 8.5)",
  "description": "Brief plot description (2-3 sentences max)",
  "poster": "No poster available",
  "detectedGenres": ["Genre1", "Genre2", "Genre3"]
}

Requirements:
- Ensure all information is accurate
- Keep the description concise but engaging
- Use actual IMDb ratings when possible
- Don't recommend the input movie(s)
- Always set poster to "No poster available"
- In detectedGenres, analyze the input movies and list the main genres that these movies share or represent`.trim();

    let prompt;
    if (movie3) {
        prompt = `Based on these three movies: "${movie1}", "${movie2}", and "${movie3}", recommend a similar movie that someone who likes all would enjoy. Also analyze what genres these movies represent and include them in detectedGenres.\n\n${baseJsonSpec}`;
    } else if (movie2) {
        prompt = `Based on these two movies: "${movie1}" and "${movie2}", recommend a similar movie that someone who likes both would enjoy. Also analyze what genres these movies represent and include them in detectedGenres.\n\n${baseJsonSpec}`;
    } else {
        prompt = `Based on this movie: "${movie1}", recommend a similar movie that someone who likes it would enjoy. Also analyze what genre this movie represents and include it in detectedGenres.\n\n${baseJsonSpec}`;
    }

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().trim();
        
        console.log('Gemini API raw response:', text);

        // Try to extract JSON from the response
        let jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No JSON found in Gemini response');
        }

        const jsonStr = jsonMatch[0];
        const movieData = JSON.parse(jsonStr);

        // Validate required fields
        const requiredFields = ['title', 'year', 'genre', 'director', 'cast', 'rating', 'description'];
        for (const field of requiredFields) {
            if (!movieData[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        // Clean and validate the data
        const cleanedData = {
            title: String(movieData.title).trim(),
            year: String(movieData.year).trim(),
            genre: String(movieData.genre).trim(),
            director: String(movieData.director).trim(),
            cast: String(movieData.cast).trim(),
            rating: String(movieData.rating).trim(),
            description: String(movieData.description).trim(),
            poster: "No poster available"
        };

        // Validate rating is a reasonable number
        const ratingNum = parseFloat(cleanedData.rating);
        if (isNaN(ratingNum) || ratingNum < 0 || ratingNum > 10) {
            cleanedData.rating = "7.5"; // Default fallback
        }

        // Extract detected genres
        const detectedGenres = Array.isArray(movieData.detectedGenres) 
            ? movieData.detectedGenres.map(g => String(g).trim()).filter(Boolean)
            : [];

            // Try to get movie poster
            try {
                const posterUrl = await getMoviePoster(cleanedData.title, cleanedData.year);
                if (posterUrl) {
                    cleanedData.poster = posterUrl;
                }
            } catch (error) {
                console.log('Could not fetch poster:', error.message);
                // Set a movie-themed poster
                const cleanTitle = cleanedData.title.replace(/[^a-zA-Z0-9\s]/g, '').substring(0, 20);
                cleanedData.poster = `data:image/svg+xml;base64,${Buffer.from(`
                    <svg width="300" height="450" xmlns="http://www.w3.org/2000/svg">
                        <rect width="300" height="450" fill="#667eea"/>
                        <text x="150" y="225" font-family="Arial, sans-serif" font-size="20" text-anchor="middle" fill="white">${cleanTitle}</text>
                    </svg>
                `).toString('base64')}`;
            }

        console.log('Processed movie recommendation:', cleanedData);
        console.log('Detected genres:', detectedGenres);
        
        return {
            movie: cleanedData,
            detectedGenres: detectedGenres
        };

    } catch (error) {
        console.error('Error calling Gemini API:', error);
        
        // Return a fallback recommendation
        return {
            movie: {
            title: "The Shawshank Redemption",
            year: "1994",
            genre: "Drama",
            director: "Frank Darabont",
            cast: "Tim Robbins, Morgan Freeman, Bob Gunton, William Sadler",
            rating: "9.3",
            description: "Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency. A timeless story of hope, friendship, and perseverance.",
                poster: "https://picsum.photos/300/450?random=1"
            },
            detectedGenres: ["Drama"]
        };
    }
}

// Health check endpoint
app.get('/health', (req, res) => {
    const effective = getEffectiveKey();
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        geminiApiKey: effective ? 'Configured' : 'Missing',
        keyInfo: effective ? {
            prefix: String(effective).slice(0, 6),
            length: String(effective).length
        } : null,
        envDiagnostics: {
            envPath,
            envExists,
            envFallbackApplied,
            envFallbackSource,
            keyFileTried,
            keyFilePath,
            keyFileAltPath,
            keyFileExistsRoot,
            keyFileExistsPublic,
            cwd: process.cwd(),
            dirname: __dirname
        }
    });
});

// Title suggestion endpoint (typeahead)
app.get('/api/suggest', async (req, res) => {
    try {
        const q = String(req.query.q || '').trim();
        if (!q || q.length < 2) {
            return res.json({ suggestions: [] });
        }

        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const EFFECTIVE_API_KEY = getEffectiveKey();
        if (!EFFECTIVE_API_KEY) return res.json({ suggestions: [] });

        const genAI = new GoogleGenerativeAI(EFFECTIVE_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'models/gemini-2.5-flash-lite' });
        const prompt = `Suggest up to 5 movie titles that start with or closely match: "${q}".\nReturn ONLY a JSON array of strings.`;
        const result = await model.generateContent(prompt);
        const text = (await result.response).text().trim();
        let list = [];
        try {
            const json = text.match(/\[[\s\S]*\]/);
            if (json) list = JSON.parse(json[0]);
        } catch (_) {}
        if (!Array.isArray(list)) list = [];
        list = list.map(s => String(s)).filter(Boolean).slice(0, 5);
        res.json({ suggestions: list });
    } catch (e) {
        res.json({ suggestions: [] });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ 
        error: 'Internal server error' 
    });
});

// Handle 404
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Endpoint not found' 
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Movie Recommendation Server running on port ${PORT}`);
    console.log(`📱 Open http://localhost:${PORT} to use the app`);
    const effective = getEffectiveKey();
    if (effective) {
        const k = String(effective);
        console.log(`🔑 Gemini API Key: ✅ Configured (prefix=${k.slice(0,6)}, length=${k.length}${envFallbackApplied ? `, source=${envFallbackSource}` : ''})`);
    } else {
        console.log(`🔑 Gemini API Key: ❌ Missing (envPath=${envPath}, exists=${envExists}, cwd=${process.cwd()}, __dirname=${__dirname})`);
    }
    
    if (!getEffectiveKey()) {
        console.log('\n⚠️  Please add your Gemini API key to the .env file:');
        console.log('   GEMINI_API_KEY=your_api_key_here\n');
    }
});
// Ollama Helper - Dragon Image Scraper
// Integration with local Polaris 4B and Gemma3:27b models

const axios = require('axios');
const fs = require('fs');
const path = require('path');

class OllamaHelper {
    constructor(options = {}) {
        this.baseUrl = options.baseUrl || 'http://localhost:11434';
        this.textModel = options.textModel || 'polaris:latest';
        this.visionModel = options.visionModel || 'gemma3:27b';
        this.timeout = options.timeout || 60000;
    }

    async testConnection() {
        try {
            const response = await axios.get(`${this.baseUrl}/api/tags`, {
                timeout: 5000
            });
            return response.status === 200;
        } catch (error) {
            console.error('Ollama connection failed:', error.message);
            return false;
        }
    }

    async listModels() {
        try {
            const response = await axios.get(`${this.baseUrl}/api/tags`);
            return response.data.models || [];
        } catch (error) {
            console.error('Failed to list models:', error.message);
            return [];
        }
    }

    // Text generation with Polaris 4B
    async generateText(prompt, options = {}) {
        try {
            const response = await axios.post(`${this.baseUrl}/api/generate`, {
                model: this.textModel,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: options.temperature || 0.7,
                    top_p: options.top_p || 0.9,
                    ...options
                }
            }, {
                timeout: this.timeout
            });

            return response.data.response;
        } catch (error) {
            console.error('Text generation failed:', error.message);
            throw error;
        }
    }

    // Vision analysis with Gemma3:27b
    async analyzeImage(imagePath, prompt = "Describe this image in detail", options = {}) {
        try {
            // Convert image to base64
            const imageBuffer = fs.readFileSync(imagePath);
            const base64Image = imageBuffer.toString('base64');

            const response = await axios.post(`${this.baseUrl}/api/generate`, {
                model: this.visionModel,
                prompt: prompt,
                images: [base64Image],
                stream: false,
                options: {
                    temperature: options.temperature || 0.3,
                    ...options
                }
            }, {
                timeout: this.timeout
            });

            return response.data.response;
        } catch (error) {
            console.error('Image analysis failed:', error.message);
            throw error;
        }
    }

    // Compare two images for similarity
    async compareImages(image1Path, image2Path, options = {}) {
        try {
            const image1Buffer = fs.readFileSync(image1Path);
            const image2Buffer = fs.readFileSync(image2Path);
            
            const base64Image1 = image1Buffer.toString('base64');
            const base64Image2 = image2Buffer.toString('base64');

            const prompt = `Compare these two images and rate their similarity on a scale from 0-100. 
                           Consider composition, subject matter, style, and overall visual similarity.
                           Respond with just the number and a brief explanation.
                           
                           Image 1: [First image]
                           Image 2: [Second image]`;

            const response = await axios.post(`${this.baseUrl}/api/generate`, {
                model: this.visionModel,
                prompt: prompt,
                images: [base64Image1, base64Image2],
                stream: false,
                options: {
                    temperature: 0.2,
                    ...options
                }
            }, {
                timeout: this.timeout
            });

            // Parse the response to extract similarity score
            const responseText = response.data.response;
            const scoreMatch = responseText.match(/(\d+(?:\.\d+)?)/);
            const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0;

            return {
                similarity: score,
                explanation: responseText,
                isMatch: score > (options.threshold || 75)
            };
        } catch (error) {
            console.error('Image comparison failed:', error.message);
            throw error;
        }
    }

    // Detect if image contains watermarks or unwanted elements
    async detectWatermarks(imagePath) {
        const prompt = `Analyze this image for watermarks, logos, text overlays, or copyright marks. 
                       Look for semi-transparent text, company logos, website URLs, or any overlaid branding.
                       Respond with: WATERMARK_DETECTED or CLEAN followed by a brief description.`;

        try {
            const analysis = await this.analyzeImage(imagePath, prompt);
            const hasWatermark = analysis.toLowerCase().includes('watermark_detected');
            
            return {
                hasWatermark,
                analysis,
                recommendation: hasWatermark ? 'REJECT' : 'ACCEPT'
            };
        } catch (error) {
            console.error('Watermark detection failed:', error.message);
            return {
                hasWatermark: false,
                analysis: 'Detection failed',
                recommendation: 'MANUAL_REVIEW'
            };
        }
    }

    // Generate image quality assessment
    async assessImageQuality(imagePath) {
        const prompt = `Assess this image's technical quality on these criteria:
                       - Sharpness and focus
                       - Proper exposure and lighting
                       - Colour balance
                       - Compression artifacts
                       - Overall professional quality
                       
                       Rate each from 1-10 and give an overall score.
                       Format: SHARPNESS:X EXPOSURE:X COLOUR:X COMPRESSION:X OVERALL:X`;

        try {
            const analysis = await this.analyzeImage(imagePath, prompt, { temperature: 0.1 });
            
            // Parse scores from response
            const scores = {
                sharpness: this.extractScore(analysis, 'sharpness'),
                exposure: this.extractScore(analysis, 'exposure'),
                colour: this.extractScore(analysis, 'colour'),
                compression: this.extractScore(analysis, 'compression'),
                overall: this.extractScore(analysis, 'overall')
            };

            return {
                scores,
                analysis,
                recommendation: scores.overall >= 7 ? 'ACCEPT' : scores.overall >= 5 ? 'REVIEW' : 'REJECT'
            };
        } catch (error) {
            console.error('Quality assessment failed:', error.message);
            return {
                scores: { overall: 5 },
                analysis: 'Assessment failed',
                recommendation: 'MANUAL_REVIEW'
            };
        }
    }

    extractScore(text, criterion) {
        const regex = new RegExp(`${criterion}[:\\s]*(\\d+(?:\\.\\d+)?)`, 'i');
        const match = text.match(regex);
        return match ? parseFloat(match[1]) : 5;
    }

    // Check if Polaris vision hack is available (future feature)
    async checkPolarisVision() {
        try {
            const models = await this.listModels();
            const polarisModel = models.find(m => m.name.includes('polaris'));
            
            if (polarisModel) {
                // Test if vision capabilities are enabled
                const testResponse = await this.analyzeImage(
                    path.join(__dirname, 'test_image.jpg'), 
                    'Can you see this image?'
                );
                return !testResponse.toLowerCase().includes('cannot') && 
                       !testResponse.toLowerCase().includes('unable');
            }
            return false;
        } catch (error) {
            return false;
        }
    }
}

module.exports = OllamaHelper;
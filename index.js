// Dragon Image Scraper - Phase 1 Foundation
// "The dragons are ready to hunt. Let's build something bloody brilliant."

const puppeteer = require('puppeteer');
const sharp = require('sharp');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
// Chalk compatibility fix for CommonJS
let chalk;
try {
    chalk = require('chalk');
} catch (err) {
    // Fallback if chalk import fails
    chalk = {
        red: { bold: (text) => `\x1b[31m\x1b[1m${text}\x1b[0m` },
        yellow: (text) => `\x1b[33m${text}\x1b[0m`,
        green: (text) => `\x1b[32m${text}\x1b[0m`,
        blue: (text) => `\x1b[34m${text}\x1b[0m`,
        red: (text) => `\x1b[31m${text}\x1b[0m`
    };
}
const cliProgress = require('cli-progress');

class DragonImageScraper {
    constructor(options = {}) {
        this.options = {
            downloadDir: options.downloadDir || './downloads',
            logDir: options.logDir || './logs',
            userAgent: options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            timeout: options.timeout || 30000,
            delay: options.delay || 2000, // Respectful delays
            ...options
        };
        
        this.browser = null;
        this.logger = null;
        this.progressBar = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;
        
        await this.initializeDirectories();
        this.initializeLogger();
        this.initialized = true;
    }

    initializeLogger() {
        const logFile = path.join(this.options.logDir, `scraper-${new Date().toISOString().split('T')[0]}.log`);
        this.logger = {
            log: (level, message, data = {}) => {
                const timestamp = new Date().toISOString();
                const logEntry = {
                    timestamp,
                    level,
                    message,
                    data
                };
                
                // Console output with colours
                const colour = level === 'ERROR' ? chalk.red : 
                              level === 'WARN' ? chalk.yellow : 
                              level === 'SUCCESS' ? chalk.green : chalk.blue;
                console.log(colour(`[${timestamp}] ${level}: ${message}`));
                
                // File output
                fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
            },
            info: (msg, data) => this.logger.log('INFO', msg, data),
            warn: (msg, data) => this.logger.log('WARN', msg, data),
            error: (msg, data) => this.logger.log('ERROR', msg, data),
            success: (msg, data) => this.logger.log('SUCCESS', msg, data)
        };
    }

    async initializeBrowser() {
        if (this.browser) return;
        
        this.logger.info('🐉 Initializing Dragon Browser...');
        
        this.browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled'
            ],
            defaultViewport: { width: 1920, height: 1080 }
        });
        
        this.logger.success('Browser initialized');
    }

    async createPage() {
        await this.initializeBrowser();
        const page = await this.browser.newPage();
        
        // Set user agent and headers to appear more human-like
        await page.setUserAgent(this.options.userAgent);
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-GB,en;q=0.9'
        });
        
        return page;
    }

    async downloadImage(url, filename, subfolder = 'candidates') {
        try {
            const response = await axios({
                method: 'GET',
                url: url,
                responseType: 'stream',
                timeout: this.options.timeout,
                headers: {
                    'User-Agent': this.options.userAgent,
                    'Referer': 'https://www.google.com/'
                }
            });

            const filepath = path.join(this.options.downloadDir, subfolder, filename);
            const writer = fs.createWriteStream(filepath);
            
            response.data.pipe(writer);
            
            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    this.logger.success(`Downloaded: ${filename}`);
                    resolve(filepath);
                });
                writer.on('error', reject);
            });
            
        } catch (error) {
            this.logger.error(`Failed to download ${url}`, { error: error.message });
            throw error;
        }
    }

    async getImageMetadata(filepath) {
        try {
            const metadata = await sharp(filepath).metadata();
            const stats = await fs.stat(filepath);
            
            return {
                width: metadata.width,
                height: metadata.height,
                format: metadata.format,
                size: stats.size,
                quality: this.assessImageQuality(metadata, stats.size),
                filepath: filepath
            };
        } catch (error) {
            this.logger.error(`Failed to get metadata for ${filepath}`, { error: error.message });
            return null;
        }
    }

    assessImageQuality(metadata, fileSize) {
        const { width, height } = metadata;
        const pixels = width * height;
        const bytesPerPixel = fileSize / pixels;
        
        // Basic quality assessment
        let score = 0;
        
        // Resolution score (0-40)
        if (pixels > 2000000) score += 40; // 2MP+
        else if (pixels > 1000000) score += 30; // 1MP+
        else if (pixels > 500000) score += 20; // 0.5MP+
        else score += 10;
        
        // File size per pixel score (0-30)
        if (bytesPerPixel > 3) score += 30; // High quality
        else if (bytesPerPixel > 1.5) score += 20; // Medium quality
        else score += 10; // Lower quality
        
        // Format score (0-30)
        if (metadata.format === 'png') score += 30;
        else if (metadata.format === 'jpeg') score += 25;
        else if (metadata.format === 'webp') score += 20;
        else score += 10;
        
        return Math.min(score, 100);
    }

    // Placeholder for Ollama integration
    async compareWithReference(candidateImagePath, referenceImagePath) {
        this.logger.info(`🧠 Comparing ${path.basename(candidateImagePath)} with reference`);
        
        // TODO: Integrate with Gemma3:27b via Ollama for vision comparison
        // For now, return a mock similarity score
        const mockSimilarity = Math.random() * 100;
        
        this.logger.info(`Similarity score: ${mockSimilarity.toFixed(2)}%`);
        return {
            similarity: mockSimilarity,
            isMatch: mockSimilarity > 75,
            candidate: candidateImagePath,
            reference: referenceImagePath
        };
    }

    async initializeDirectories() {
        await fs.ensureDir(this.options.downloadDir);
        await fs.ensureDir(this.options.logDir);
        await fs.ensureDir(path.join(this.options.downloadDir, 'reference'));
        await fs.ensureDir(path.join(this.options.downloadDir, 'candidates'));
    }

    async scrapeTestImages(urls) {
        await this.initialize(); // Ensure directories exist first
        
        this.logger.info(`🐉 Starting test scrape of ${urls.length} images`);
        
        this.progressBar = new cliProgress.SingleBar({
            format: 'Dragon Progress |{bar}| {percentage}% | {value}/{total} Images',
            barCompleteChar: '🐉',
            barIncompleteChar: '-'
        }, cliProgress.Presets.shades_classic);
        
        this.progressBar.start(urls.length, 0);
        
        const results = [];
        
        for (let i = 0; i < urls.length; i++) {
            try {
                const url = urls[i];
                const filename = `test_image_${i + 1}_${Date.now()}.jpg`;
                
                await this.delay(this.options.delay);
                
                const filepath = await this.downloadImage(url, filename);
                const metadata = await this.getImageMetadata(filepath);
                
                results.push({
                    url,
                    filepath,
                    metadata,
                    success: true
                });
                
            } catch (error) {
                results.push({
                    url: urls[i],
                    error: error.message,
                    success: false
                });
            }
            
            this.progressBar.increment();
        }
        
        this.progressBar.stop();
        
        const successful = results.filter(r => r.success).length;
        this.logger.success(`Dragon hunt complete! ${successful}/${urls.length} images captured`);
        
        return results;
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            this.logger.info('🐉 Dragon browser closed');
        }
    }
}

// Test runner for Phase 1
async function runPhase1Test() {
    console.log(chalk.red.bold('🐉 DRAGON IMAGE SCRAPER - PHASE 1 TEST'));
    console.log(chalk.yellow('Embrace the Dragon\n'));
    
    const scraper = new DragonImageScraper({
        downloadDir: './test_downloads',
        delay: 1000 // Faster for testing
    });
    
    // Test URLs (replace with actual test images)
    const testUrls = [
        'https://picsum.photos/800/600?random=1',
        'https://picsum.photos/1200/800?random=2',
        'https://picsum.photos/600/400?random=3'
    ];
    
    try {
        const results = await scraper.scrapeTestImages(testUrls);
        
        console.log('\n📊 Results Summary:');
        results.forEach((result, index) => {
            if (result.success) {
                console.log(chalk.green(`✅ Image ${index + 1}: ${result.metadata.width}x${result.metadata.height}, Quality: ${result.metadata.quality}%`));
            } else {
                console.log(chalk.red(`❌ Image ${index + 1}: ${result.error}`));
            }
        });
        
    } catch (error) {
        console.error(chalk.red('Test failed:'), error);
    } finally {
        await scraper.cleanup();
    }
}

// Export for use in other modules
module.exports = DragonImageScraper;

// Run test if called directly
if (require.main === module) {
    runPhase1Test().catch(console.error);
}
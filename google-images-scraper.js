// Google Images Scraper - Phase 2 Intelligence Layer
// "Navigate the labyrinth, find the treasure"

const DragonImageScraper = require('./index.js');
const puppeteer = require('puppeteer');
const path = require('path');
const url = require('url');

class GoogleImagesScraper extends DragonImageScraper {
    constructor(options = {}) {
        super(options);
        
        this.googleOptions = {
            maxResults: options.maxResults || 50,
            minWidth: options.minWidth || 500,
            minHeight: options.minHeight || 500,
            safeSearch: options.safeSearch || 'moderate',
            imageType: options.imageType || 'photo', // photo, clipart, lineart
            size: options.size || 'large', // small, medium, large, xlarge
            ...options.googleOptions
        };
        
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
        ];
    }

    getRandomUserAgent() {
        return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    }

    buildGoogleImagesURL(searchTerm) {
        const params = new URLSearchParams({
            q: searchTerm,
            tbm: 'isch', // Images search
            safe: this.googleOptions.safeSearch,
            tbs: `isz:${this.googleOptions.size},itp:${this.googleOptions.imageType}`,
            hl: 'en-GB'
        });
        
        return `https://www.google.com/search?${params.toString()}`;
    }

    async searchGoogleImages(searchTerm, maxResults = null) {
        await this.initialize();
        
        const resultLimit = maxResults || this.googleOptions.maxResults;
        this.logger.info(`🐉 Hunting Google Images for: "${searchTerm}" (target: ${resultLimit} images)`);
        
        const page = await this.createPage();
        const searchURL = this.buildGoogleImagesURL(searchTerm);
        
        try {
            // Set random user agent for this session
            await page.setUserAgent(this.getRandomUserAgent());
            
            // Navigate to Google Images
            await page.goto(searchURL, { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });
            
            this.logger.info('📍 Reached Google Images search results');
            
            // Handle cookie consent popup
            await this.handleCookieConsent(page);
            
            // Wait for images to load
            await page.waitForSelector('img[data-src], img[src]', { timeout: 10000 });
            
            // Scroll to load more images
            await this.scrollToLoadImages(page, resultLimit);
            
            // Extract image data
            const imageData = await this.extractImageData(page, resultLimit);
            
            this.logger.success(`🎯 Found ${imageData.length} image candidates`);
            
            await page.close();
            return imageData;
            
        } catch (error) {
            this.logger.error('Google Images search failed', { error: error.message, searchTerm });
            await page.close();
            throw error;
        }
    }

    async handleCookieConsent(page) {
        try {
            this.logger.info('🍪 Checking for cookie consent dialog...');
            
            // Wait a moment for the dialog to appear
            await this.delay(2000);
            
            // Common Google cookie consent selectors
            const consentSelectors = [
                'button[id*="accept"]',
                'button:contains("Accept all")',
                'button:contains("I agree")',
                'button:contains("Accept")',
                '[role="button"]:contains("Accept")',
                'div[role="button"]:contains("Accept")'
            ];
            
            // Try to find and click accept button
            for (const selector of consentSelectors) {
                try {
                    const button = await page.$(selector);
                    if (button) {
                        await button.click();
                        this.logger.success('✅ Cookie consent accepted');
                        await this.delay(3000); // Wait for page to reload
                        return;
                    }
                } catch (e) {
                    // Continue to next selector
                }
            }
            
            // Alternative approach: look for visible buttons with "Accept" text
            const acceptButtons = await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button, div[role="button"], [role="button"]'));
                return buttons.filter(btn => {
                    const text = btn.textContent?.toLowerCase() || '';
                    return text.includes('accept') || text.includes('agree') || text.includes('continue');
                });
            });
            
            if (acceptButtons.length > 0) {
                await page.evaluate(() => {
                    const buttons = Array.from(document.querySelectorAll('button, div[role="button"], [role="button"]'));
                    const acceptBtn = buttons.find(btn => {
                        const text = btn.textContent?.toLowerCase() || '';
                        return text.includes('accept') || text.includes('agree') || text.includes('continue');
                    });
                    if (acceptBtn) acceptBtn.click();
                });
                
                this.logger.success('✅ Cookie consent handled via JavaScript');
                await this.delay(3000);
            } else {
                this.logger.info('ℹ️  No cookie consent dialog found');
            }
            
        } catch (error) {
            this.logger.warn('Cookie consent handling failed', { error: error.message });
        }
    }

    async scrollToLoadImages(page, targetCount) {
        this.logger.info('🔄 Scrolling to load more images...');
        
        let lastHeight = 0;
        let attempts = 0;
        const maxAttempts = 10;
        
        while (attempts < maxAttempts) {
            // Scroll to bottom
            await page.evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight);
            });
            
            // Wait for new content to load
            await this.delay(2000);
            
            // Check if we have enough images
            const imageCount = await page.evaluate(() => {
                return document.querySelectorAll('img[data-src], img[src*="gstatic"]').length;
            });
            
            if (imageCount >= targetCount) {
                this.logger.info(`✅ Loaded ${imageCount} images (target: ${targetCount})`);
                break;
            }
            
            // Check if page height changed (new content loaded)
            const newHeight = await page.evaluate(() => document.body.scrollHeight);
            if (newHeight === lastHeight) {
                // Try clicking "Show more results" if available
                try {
                    await page.click('input[value="Show more results"]');
                    await this.delay(3000);
                } catch (e) {
                    // No more results button, we've hit the limit
                    break;
                }
            }
            
            lastHeight = newHeight;
            attempts++;
            
            this.logger.info(`📜 Scroll attempt ${attempts}: ${imageCount} images loaded`);
        }
    }

    async extractImageData(page, maxResults) {
        this.logger.info('🔍 Extracting image data via Google LDI parsing...');
        
        const imageData = await page.evaluate((maxResults) => {
            const images = [];
            
            // Method 1: Parse google.ldi object (the golden data!)
            let ldiImages = [];
            if (window.google && window.google.ldi) {
                console.log('Found google.ldi with', Object.keys(window.google.ldi).length, 'entries');
                
                for (const [imageId, imageUrl] of Object.entries(window.google.ldi)) {
                    // Find the corresponding DOM element
                    const imgElement = document.getElementById(imageId) || 
                                     document.querySelector(`img[data-iid="${imageId}"]`);
                    
                    if (imgElement) {
                        // Try to find source URL from parent links
                        let sourceUrl = null;
                        let parent = imgElement.closest('a');
                        if (!parent) parent = imgElement.parentElement?.closest('a');
                        if (!parent) parent = imgElement.parentElement?.parentElement?.closest('a');
                        
                        if (parent && parent.href && !parent.href.includes('javascript:')) {
                            sourceUrl = parent.href;
                        }
                        
                        // Get title/alt text
                        const title = imgElement.alt || imgElement.title || '';
                        
                        // Get dimensions (these might be display dimensions)
                        const width = imgElement.naturalWidth || imgElement.width || 150;
                        const height = imgElement.naturalHeight || imgElement.height || 150;
                        
                        ldiImages.push({
                            imageUrl: imageUrl,
                            sourceUrl: sourceUrl,
                            title: title,
                            width: width,
                            height: height,
                            thumbnail: true,
                            method: 'google_ldi',
                            imageId: imageId
                        });
                    }
                }
                
                console.log('Extracted', ldiImages.length, 'images from google.ldi');
            } else {
                console.log('google.ldi not found, trying fallback methods');
            }
            
            // Method 2: Fallback - Parse from script tags if LDI not available
            let scriptImages = [];
            if (ldiImages.length === 0) {
                const scripts = document.querySelectorAll('script');
                for (const script of scripts) {
                    const content = script.textContent || script.innerText || '';
                    
                    // Look for google.ldi assignments in script content
                    const ldiMatches = content.match(/google\.ldi\s*=\s*({[^}]+})/);
                    if (ldiMatches) {
                        try {
                            const ldiData = JSON.parse(ldiMatches[1]);
                            console.log('Found LDI data in script tag:', Object.keys(ldiData).length, 'entries');
                            
                            for (const [imageId, imageUrl] of Object.entries(ldiData)) {
                                const imgElement = document.getElementById(imageId) || 
                                                 document.querySelector(`img[data-iid="${imageId}"]`);
                                
                                if (imgElement) {
                                    scriptImages.push({
                                        imageUrl: imageUrl,
                                        sourceUrl: null, // Will try to find this later
                                        title: imgElement.alt || imgElement.title || '',
                                        width: imgElement.naturalWidth || imgElement.width || 150,
                                        height: imgElement.naturalHeight || imgElement.height || 150,
                                        thumbnail: true,
                                        method: 'script_parsing',
                                        imageId: imageId
                                    });
                                }
                            }
                        } catch (e) {
                            console.log('Failed to parse LDI from script:', e);
                        }
                    }
                }
            }
            
            // Method 3: Ultimate fallback - traditional DOM parsing with better selectors
            let domImages = [];
            const combinedImages = ldiImages.length > 0 ? ldiImages : scriptImages;
            
            if (combinedImages.length === 0) {
                console.log('No LDI data found, using DOM parsing fallback');
                
                const selectors = [
                    'img[data-src]',
                    'img[src*="gstatic"]',
                    'img[src*="googleusercontent"]',
                    '.rg_i img',
                    'img'
                ];
                
                let allImageElements = [];
                for (const selector of selectors) {
                    const elements = document.querySelectorAll(selector);
                    allImageElements = [...allImageElements, ...Array.from(elements)];
                }
                
                // Remove duplicates
                const uniqueImages = [...new Set(allImageElements)];
                
                for (const img of uniqueImages) {
                    if (domImages.length >= maxResults) break;
                    
                    // Skip tiny images
                    if (img.width < 80 || img.height < 80) continue;
                    
                    let imageUrl = img.dataset.src || img.src;
                    if (!imageUrl || imageUrl.includes('data:image') || imageUrl.includes('logo')) continue;
                    
                    // Skip obvious UI elements
                    if (imageUrl.includes('gstatic.com') && (
                        imageUrl.includes('ui') || 
                        imageUrl.includes('icon') || 
                        imageUrl.includes('logo')
                    )) continue;
                    
                    domImages.push({
                        imageUrl: imageUrl,
                        sourceUrl: null,
                        title: img.alt || img.title || '',
                        width: img.naturalWidth || img.width || 100,
                        height: img.naturalHeight || img.height || 100,
                        thumbnail: true,
                        method: 'dom_parsing'
                    });
                }
            }
            
            // Use the best method we found
            const finalImages = ldiImages.length > 0 ? ldiImages : 
                               scriptImages.length > 0 ? scriptImages : 
                               domImages;
            
            console.log(`Final extraction: ${finalImages.length} images using ${finalImages[0]?.method || 'none'}`);
            
            return finalImages.slice(0, maxResults);
            
        }, maxResults);
        
        // Enhanced filtering - be less aggressive since these are better quality
        const filteredData = imageData
            .filter(img => img.imageUrl && !img.imageUrl.includes('data:'))
            .filter(img => {
                // More lenient filtering for LDI images since they're known good
                if (img.method === 'google_ldi' || img.method === 'script_parsing') {
                    return img.width >= 50 && img.height >= 50; // Very lenient
                } else {
                    return img.width >= this.googleOptions.minWidth && img.height >= this.googleOptions.minHeight;
                }
            })
            .slice(0, maxResults);
            
        this.logger.info(`📋 Extracted ${filteredData.length} images using method: ${filteredData[0]?.method || 'none'}`);
        
        if (filteredData.length > 0) {
            this.logger.info(`🎯 Sample URLs: ${filteredData.slice(0, 3).map(img => img.imageUrl.substring(0, 50) + '...').join(', ')}`);
        }
        
        return filteredData;
    }

    async navigateToSourcePage(imageData) {
        if (!imageData.sourceUrl) {
            this.logger.warn('No source URL available for image', { imageUrl: imageData.imageUrl });
            return imageData;
        }
        
        this.logger.info(`🧭 Navigating to source: ${this.getDomain(imageData.sourceUrl)}`);
        
        const page = await this.createPage();
        
        try {
            await page.goto(imageData.sourceUrl, { 
                waitUntil: 'networkidle2',
                timeout: 20000 
            });
            
            // Look for higher resolution version of the image
            const higherResUrl = await this.findHigherResolution(page, imageData);
            
            await page.close();
            
            if (higherResUrl && higherResUrl !== imageData.imageUrl) {
                this.logger.success(`📈 Found higher resolution: ${higherResUrl}`);
                return {
                    ...imageData,
                    imageUrl: higherResUrl,
                    originalThumbnail: imageData.imageUrl,
                    thumbnail: false
                };
            }
            
            return imageData;
            
        } catch (error) {
            this.logger.warn('Failed to navigate to source page', { 
                error: error.message,
                sourceUrl: imageData.sourceUrl 
            });
            await page.close();
            return imageData;
        }
    }

    async findHigherResolution(page, originalData) {
        try {
            // Strategy 1: Look for images with similar names or larger dimensions
            const betterImages = await page.evaluate((original) => {
                const images = Array.from(document.querySelectorAll('img'));
                const candidates = [];
                
                for (const img of images) {
                    // Skip tiny images
                    if (img.width < 200 || img.height < 200) continue;
                    
                    const src = img.src || img.dataset.src || img.dataset.original;
                    if (!src || src.includes('data:')) continue;
                    
                    // Check if dimensions are significantly larger
                    const pixelCount = img.naturalWidth * img.naturalHeight;
                    const originalPixels = original.width * original.height;
                    
                    if (pixelCount > originalPixels * 1.5) {
                        candidates.push({
                            src: src,
                            width: img.naturalWidth || img.width,
                            height: img.naturalHeight || img.height,
                            pixelCount: pixelCount
                        });
                    }
                }
                
                // Return the largest image found
                return candidates.sort((a, b) => b.pixelCount - a.pixelCount)[0];
            }, originalData);
            
            return betterImages ? betterImages.src : null;
            
        } catch (error) {
            this.logger.warn('Higher resolution search failed', { error: error.message });
            return null;
        }
    }

    async downloadImageBatch(imageDataArray, searchTerm) {
        await this.initialize();
        
        this.logger.info(`🐉 Starting batch download: ${imageDataArray.length} images for "${searchTerm}"`);
        
        const progressBar = new (require('cli-progress')).SingleBar({
            format: 'Dragon Download |{bar}| {percentage}% | {value}/{total} | {filename}',
            barCompleteChar: '🐉',
            barIncompleteChar: '-'
        });
        
        progressBar.start(imageDataArray.length, 0, { filename: 'Starting...' });
        
        const results = [];
        const searchFolder = searchTerm.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        
        for (let i = 0; i < imageDataArray.length; i++) {
            const imageData = imageDataArray[i];
            
            try {
                // For LDI images, skip source page navigation since we have direct URLs
                let enhancedData = imageData;
                if (!imageData.method || imageData.method === 'dom_parsing') {
                    // Only try source page navigation for DOM-parsed images
                    enhancedData = await this.navigateToSourcePage(imageData);
                } else {
                    // For LDI images, just use the direct thumbnail URL
                    this.logger.info(`🎯 Using direct LDI URL: ${imageData.imageUrl.substring(0, 50)}...`);
                }
                
                // Generate filename
                const extension = this.getImageExtension(enhancedData.imageUrl) || 'jpg';
                const filename = `${searchFolder}_${i + 1}_${Date.now()}.${extension}`;
                
                progressBar.update(i, { filename: filename });
                
                await this.delay(this.options.delay); // Respectful delay
                
                const filepath = await this.downloadImage(
                    enhancedData.imageUrl, 
                    filename, 
                    'candidates' // Just dump everything in candidates folder
                );
                
                const metadata = await this.getImageMetadata(filepath);
                
                results.push({
                    ...enhancedData,
                    filepath: filepath,
                    metadata: metadata,
                    searchTerm: searchTerm,
                    success: true
                });
                
            } catch (error) {
                this.logger.error(`Failed to download image ${i + 1}`, { error: error.message });
                results.push({
                    ...imageData,
                    error: error.message,
                    success: false
                });
            }
            
            progressBar.increment();
        }
        
        progressBar.stop();
        
        const successful = results.filter(r => r.success).length;
        this.logger.success(`🎯 Dragon hunt complete! ${successful}/${imageDataArray.length} images captured for "${searchTerm}"`);
        
        return results;
    }

    getDomain(url) {
        try {
            return new URL(url).hostname;
        } catch {
            return 'unknown';
        }
    }

    getImageExtension(imageUrl) {
        try {
            const pathname = new URL(imageUrl).pathname;
            const ext = path.extname(pathname).toLowerCase().substring(1);
            return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg';
        } catch {
            return 'jpg';
        }
    }
}

// Test runner for Phase 2
async function runPhase2Test() {
    console.log(require('chalk').red.bold('🐉 DRAGON IMAGE SCRAPER - PHASE 2 TEST'));
    console.log(require('chalk').yellow('Google Images Navigation Test\n'));
    
    const scraper = new GoogleImagesScraper({
        downloadDir: './phase2_downloads',
        delay: 2000, // Be respectful to Google
        maxResults: 10 // Small test batch
    });
    
    try {
        // Test search
        const searchTerm = 'beautiful landscape photography';
        const imageData = await scraper.searchGoogleImages(searchTerm, 5);
        
        if (imageData.length > 0) {
            console.log('\n📋 Found images:');
            imageData.forEach((img, index) => {
                console.log(`${index + 1}. ${img.width}x${img.height} - ${scraper.getDomain(img.sourceUrl || 'unknown')}`);
            });
            
            // Download a couple of test images
            const testBatch = imageData.slice(0, 3);
            await scraper.downloadImageBatch(testBatch, searchTerm);
        } else {
            console.log('❌ No images found - Google may be blocking us');
        }
        
    } catch (error) {
        console.error(require('chalk').red('Phase 2 test failed:'), error.message);
    } finally {
        await scraper.cleanup();
    }
}

module.exports = GoogleImagesScraper;

// Run test if called directly
if (require.main === module) {
    runPhase2Test().catch(console.error);
}
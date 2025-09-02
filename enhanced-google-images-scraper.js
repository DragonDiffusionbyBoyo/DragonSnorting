// Enhanced Google Images Scraper - Full Resolution Image Extraction
// "The dragons demand the full treasure, not mere glimpses"

const DragonImageScraper = require('./index.js');
const puppeteer = require('puppeteer');
const path = require('path');
const url = require('url');

class EnhancedGoogleImagesScraper extends DragonImageScraper {
    constructor(options = {}) {
        super(options);
        
        this.googleOptions = {
            maxResults: options.maxResults || 50,
            minWidth: options.minWidth || 400,  
            minHeight: options.minHeight || 400,  
            minMegapixels: options.minMegapixels || 0.4, // Lowered from 0.5 to 0.4
            safeSearch: options.safeSearch || 'moderate',
            imageType: options.imageType || 'photo',
            size: options.size || 'large',
            maxSourceNavigations: options.maxSourceNavigations || 3,
            fallbackToThumbnails: options.fallbackToThumbnails === true,
            ...options.googleOptions
        };
        
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ];
        
        // Ensure initialization happens
        this.initialized = false;
    }

    async ensureInitialized() {
        if (!this.initialized) {
            await this.initializeDirectories();
            this.initializeLogger();
            this.initialized = true;
        }
    }

    getRandomUserAgent() {
        return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    }

    buildGoogleImagesURL(searchTerm) {
        const params = new URLSearchParams({
            q: searchTerm,
            tbm: 'isch',
            safe: this.googleOptions.safeSearch,
            tbs: `isz:${this.googleOptions.size},itp:${this.googleOptions.imageType}`,
            hl: 'en-GB',
            gl: 'gb'
        });
        
        return `https://www.google.com/search?${params.toString()}`;
    }

    async searchGoogleImages(searchTerm, maxResults = null) {
        await this.ensureInitialized();
        await this.initializeBrowser();
        
        const resultLimit = maxResults || this.googleOptions.maxResults;
        this.logger.info(`🐉 Hunting Google Images for: "${searchTerm}" (target: ${resultLimit} images)`);
        
        const page = await this.createPage();
        const searchURL = this.buildGoogleImagesURL(searchTerm);
        
        try {
            await page.setUserAgent(this.getRandomUserAgent());
            
            // Navigate to Google Images
            await page.goto(searchURL, { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });
            
            // Handle cookie consent if present
            await this.handleCookieConsent(page);
            
            this.logger.info('📍 Reached Google Images search results');
            
            // Wait for images to load
            await page.waitForSelector('img', { timeout: 10000 });
            
            // Scroll to load more images
            await this.scrollToLoadImages(page, resultLimit);
            
            // Extract enhanced image data with full-size URLs
            const imageData = await this.extractEnhancedImageData(page, resultLimit);
            
            this.logger.success(`🎯 Found ${imageData.length} image candidates with source data`);
            
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
            // Wait for consent button and click it
            const consentButton = await page.waitForSelector('button[id*="accept"], button[id*="consent"], #L2AGLb', { 
                timeout: 5000 
            });
            if (consentButton) {
                await consentButton.click();
                await this.delay(2000);
                this.logger.info('✅ Cookie consent accepted');
            }
        } catch (error) {
            // Consent dialog might not appear or be different
            this.logger.info('No cookie consent dialog found');
        }
    }

    async scrollToLoadImages(page, targetCount) {
        this.logger.info('🔄 Scrolling to load more images...');
        
        let lastImageCount = 0;
        let attempts = 0;
        const maxAttempts = 10;
        
        while (attempts < maxAttempts) {
            await page.evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight);
            });
            
            await this.delay(2000);
            
            const currentImageCount = await page.evaluate(() => {
                return document.querySelectorAll('img[src*="encrypted-tbn"]').length;
            });
            
            if (currentImageCount >= targetCount) {
                this.logger.info(`✅ Loaded ${currentImageCount} images (target: ${targetCount})`);
                break;
            }
            
            if (currentImageCount === lastImageCount) {
                // Try to click "Show more results" button
                try {
                    await page.click('input[value="Show more results"], .mye4qd');
                    await this.delay(3000);
                } catch (e) {
                    this.logger.info('No more results available');
                    break;
                }
            }
            
            lastImageCount = currentImageCount;
            attempts++;
            
            this.logger.info(`📜 Scroll attempt ${attempts}: ${currentImageCount} images loaded`);
        }
    }

    async extractEnhancedImageData(page, maxResults) {
        this.logger.info('🔍 Extracting enhanced image data with REAL full-size URLs...');
        
        const imageData = await page.evaluate((maxResults) => {
            const images = [];
            
            // Method 1: Extract from Google's LDI data AND get source page URLs
            try {
                if (window.google && window.google.ldi) {
                    console.log('Found LDI data, extracting with source URLs...');
                    const ldiData = window.google.ldi;
                    
                    for (const [key, value] of Object.entries(ldiData)) {
                        if (images.length >= maxResults) break;
                        
                        try {
                            const data = JSON.parse(value);
                            if (data && data[1] && Array.isArray(data[1])) {
                                const imageInfo = data[1];
                                
                                const thumbnailUrl = imageInfo[0] || null;
                                const fullSizeUrl = imageInfo[3] || null;
                                
                                // More aggressive source URL extraction
                                let sourcePageUrl = null;
                                let originalImageUrl = null;
                                
                                // Try multiple positions for source data
                                for (let i = 4; i < imageInfo.length; i++) {
                                    const item = imageInfo[i];
                                    if (typeof item === 'string') {
                                        if (item.startsWith('http') && !item.includes('encrypted-tbn') && !item.includes('google')) {
                                            if (item.includes('.jpg') || item.includes('.png') || item.includes('.jpeg') || item.includes('.webp')) {
                                                originalImageUrl = item;
                                                break;
                                            } else if (!sourcePageUrl) {
                                                sourcePageUrl = item;
                                            }
                                        }
                                    }
                                }
                                
                                if (thumbnailUrl && thumbnailUrl.includes('encrypted-tbn')) {
                                    images.push({
                                        thumbnailUrl: thumbnailUrl,
                                        fullSizeUrl: originalImageUrl || fullSizeUrl,
                                        sourcePageUrl: sourcePageUrl,
                                        title: imageInfo[6] || '',
                                        width: imageInfo[1] || 0,
                                        height: imageInfo[2] || 0,
                                        source: 'ldi-enhanced',
                                        rawData: imageInfo
                                    });
                                }
                            }
                        } catch (parseError) {
                            continue;
                        }
                    }
                }
            } catch (error) {
                console.warn('LDI extraction failed:', error);
            }
            
            // Method 2: Extract from Google Images result containers with imgres links
            if (images.length < maxResults) {
                console.log('Searching for imgres links with REAL image URLs...');
                
                // Look for actual imgres links - these contain the full-size URLs!
                const imgresLinks = document.querySelectorAll('a[href*="imgres"]');
                
                for (const link of imgresLinks) {
                    if (images.length >= maxResults) break;
                    
                    try {
                        const url = new URL(link.href);
                        const imgurl = url.searchParams.get('imgurl'); // THE REAL IMAGE URL!
                        const imgrefurl = url.searchParams.get('imgrefurl'); // SOURCE PAGE
                        const width = parseInt(url.searchParams.get('w')) || 0;
                        const height = parseInt(url.searchParams.get('h')) || 0;
                        const tbnid = url.searchParams.get('tbnid');
                        
                        if (imgurl && width > 512 && height > 512) {
                            // Calculate megapixels to ensure we're getting substantial images
                            const megapixels = (width * height) / 1000000;
                            
                            // Only accept images that are genuinely high quality
                            if (megapixels >= 0.5) { // At least 0.5MP
                                // Find the associated thumbnail for this imgres link
                                let thumbnailUrl = null;
                                const container = link.closest('[data-ved], .isv-r, .rg_bx') || link.parentElement;
                                const thumbnail = container?.querySelector('img[src*="encrypted-tbn"]');
                                if (thumbnail) {
                                    thumbnailUrl = thumbnail.src;
                                }
                                
                                images.push({
                                    thumbnailUrl: thumbnailUrl,
                                    fullSizeUrl: decodeURIComponent(imgurl), // DECODE THE REAL URL
                                    sourcePageUrl: imgrefurl ? decodeURIComponent(imgrefurl) : null,
                                    title: link.getAttribute('aria-label') || '',
                                    width: width,
                                    height: height,
                                    megapixels: megapixels,
                                    source: 'imgres-link',
                                    tbnid: tbnid
                                });
                                
                                console.log(`Found HIGH-QUALITY image: ${width}x${height} (${megapixels.toFixed(1)}MP) - ${imgurl.substring(0, 50)}...`);
                            } else {
                                console.log(`Rejected small image: ${width}x${height} (${megapixels.toFixed(1)}MP) - too small`);
                            }
                        } else {
                            console.log(`Rejected tiny image: ${width}x${height} - below 512x512 minimum`);
                        }
                    } catch (e) {
                        console.warn('Failed to parse imgres link:', e);
                    }
                }
            }
            
            // Method 3: Advanced script parsing for source URLs
            if (images.length < maxResults) {
                console.log('Advanced script parsing for real image URLs...');
                
                const scripts = document.querySelectorAll('script');
                for (const script of scripts) {
                    if (images.length >= maxResults) break;
                    
                    const content = script.textContent || '';
                    
                    // Look for patterns that contain both thumbnail and original URLs
                    if (content.includes('encrypted-tbn') && content.includes('http')) {
                        try {
                            // More sophisticated regex to find image URL pairs
                            const urlPairPattern = /"(https:\/\/encrypted-tbn[^"]+)"[^"]*"([^"]*\.(jpg|jpeg|png|webp)[^"]*)?"/gi;
                            let match;
                            
                            while ((match = urlPairPattern.exec(content)) && images.length < maxResults) {
                                const thumbnailUrl = match[1];
                                const possibleOriginal = match[2];
                                
                                if (thumbnailUrl && thumbnailUrl.includes('encrypted-tbn')) {
                                    let originalImageUrl = null;
                                    
                                    // Look for nearby URLs in the same script block
                                    const surroundingText = content.substring(Math.max(0, match.index - 500), match.index + 500);
                                    const nearbyUrls = surroundingText.match(/https?:\/\/[^\s"]+\.(jpg|jpeg|png|webp)[^\s"]*/gi);
                                    
                                    if (nearbyUrls && nearbyUrls.length > 0) {
                                        // Find the most likely original (longest, most complex URL)
                                        originalImageUrl = nearbyUrls.reduce((best, current) => 
                                            current.length > (best?.length || 0) && !current.includes('encrypted-tbn') ? current : best
                                        , null);
                                    }
                                    
                                    images.push({
                                        thumbnailUrl: thumbnailUrl,
                                        fullSizeUrl: originalImageUrl,
                                        sourcePageUrl: null,
                                        title: '',
                                        width: 0,
                                        height: 0,
                                        source: 'script-enhanced'
                                    });
                                }
                            }
                        } catch (error) {
                            console.warn('Advanced script parsing error:', error);
                        }
                    }
                }
            }
            
            console.log(`Extracted ${images.length} images with enhanced metadata`);
            return images.slice(0, maxResults);
        }, maxResults);
        
        this.logger.info(`📋 Extracted ${imageData.length} images with enhanced source data`);
        
        // Log sources and quality of extraction
        const sourceCounts = imageData.reduce((acc, img) => {
            acc[img.source] = (acc[img.source] || 0) + 1;
            return acc;
        }, {});
        
        const withFullSize = imageData.filter(img => img.fullSizeUrl && img.fullSizeUrl !== img.thumbnailUrl).length;
        const withSourcePage = imageData.filter(img => img.sourcePageUrl).length;
        
        this.logger.info('📊 Extraction sources:', sourceCounts);
        this.logger.info(`🎯 Quality: ${withFullSize} full-size URLs, ${withSourcePage} source pages`);
        
        // Log sample URLs for debugging
        if (imageData.length > 0) {
            this.logger.info('🔍 Sample extracted data:');
            imageData.slice(0, 2).forEach((img, i) => {
                const hasFullSize = img.fullSizeUrl && img.fullSizeUrl !== img.thumbnailUrl ? '🎯' : '📷';
                const hasSource = img.sourcePageUrl ? '🔗' : '❌';
                this.logger.info(`  ${i + 1}. ${hasFullSize} ${img.width}x${img.height} ${hasSource} [${img.source}]`);
                if (img.fullSizeUrl && img.fullSizeUrl !== img.thumbnailUrl) {
                    this.logger.info(`     Full: ${img.fullSizeUrl.substring(0, 60)}...`);
                }
                if (img.sourcePageUrl) {
                    this.logger.info(`     Source: ${img.sourcePageUrl.substring(0, 60)}...`);
                }
            });
        }
        
        return imageData;
    }

    async navigateToSourceForFullSize(imageData) {
        await this.ensureInitialized();
        
        // Clean and validate URLs first
        const cleanThumbnailUrl = this.cleanImageUrl(imageData.thumbnailUrl);
        const cleanFullSizeUrl = imageData.fullSizeUrl ? this.cleanImageUrl(imageData.fullSizeUrl) : null;
        
        // Always ensure we have a fallback URL
        if (!cleanThumbnailUrl) {
            this.logger.error('No valid thumbnail URL available');
            return { ...imageData, finalImageUrl: null, resolution: 'failed' };
        }
        
        // If we have a full-size URL from imgres data, try it first - this is the REAL image!
        if (cleanFullSizeUrl && cleanFullSizeUrl !== cleanThumbnailUrl) {
            try {
                const testResponse = await require('axios').head(cleanFullSizeUrl, { 
                    timeout: 15000,
                    headers: { 
                        'User-Agent': this.getRandomUserAgent(),
                        'Referer': 'https://www.google.com/'
                    }
                });
                
                if (testResponse.status === 200) {
                    this.logger.success(`🎯 Using REAL full-size URL from imgres data!`);
                    return {
                        ...imageData,
                        finalImageUrl: cleanFullSizeUrl,
                        resolution: 'real-fullsize'
                    };
                }
            } catch (error) {
                this.logger.warn(`Full-size URL failed (${error.response?.status || error.message}), trying source page`);
            }
        }
        
        // Try source page navigation if available and within limits
        if (imageData.sourcePageUrl) {
            const domain = this.getDomain(imageData.sourcePageUrl);
            this.logger.info(`🧭 Attempting source navigation: ${domain}`);
            
            const page = await this.createPage();
            
            try {
                await page.goto(imageData.sourcePageUrl, { 
                    waitUntil: 'networkidle2',
                    timeout: 20000 
                });
                
                const higherResUrl = await this.findHighestResolutionImage(page, imageData);
                
                await page.close();
                
                if (higherResUrl && higherResUrl !== cleanThumbnailUrl) {
                    const cleanHigherRes = this.cleanImageUrl(higherResUrl);
                    if (cleanHigherRes) {
                        this.logger.success(`📈 Found enhanced resolution from source`);
                        return {
                            ...imageData,
                            finalImageUrl: cleanHigherRes,
                            resolution: 'enhanced'
                        };
                    }
                }
                
            } catch (error) {
                this.logger.warn('Source page navigation failed', { 
                    error: error.message,
                    domain: domain 
                });
                await page.close();
            }
        }
        
        // Fallback to thumbnail
        return { 
            ...imageData, 
            finalImageUrl: cleanThumbnailUrl, 
            resolution: 'thumbnail' 
        };
    }

    cleanImageUrl(url) {
        if (!url) return null;
        
        try {
            // Handle URL-encoded characters
            let cleanUrl = url.replace(/\\u003d/g, '=').replace(/\\u0026/g, '&');
            
            // Validate it's a proper URL
            new URL(cleanUrl);
            
            return cleanUrl;
        } catch (error) {
            this.logger.warn('Invalid URL format', { url: url });
            return null;
        }
    }

    async findHighestResolutionImage(page, originalData) {
        try {
            // Strategy 1: Look for the largest image on the page
            const bestImage = await page.evaluate((original) => {
                const images = Array.from(document.querySelectorAll('img'));
                let bestCandidate = null;
                let highestPixelCount = 0;
                
                for (const img of images) {
                    // More demanding size requirements for source page images
                    if (img.width < 512 || img.height < 512) continue;
                    
                    const src = img.src || img.dataset.src || img.dataset.original || img.dataset.lazy;
                    if (!src || src.includes('data:') || src.includes('placeholder') || src.includes('spinner')) continue;
                    
                    // Skip if it's clearly an ad or navigation element
                    if (src.includes('ads') || src.includes('logo') || src.includes('nav') || 
                        img.className?.includes('ad') || img.className?.includes('logo')) continue;
                    
                    const pixelCount = (img.naturalWidth || img.width) * (img.naturalHeight || img.height);
                    const megapixels = pixelCount / 1000000;
                    
                    // Must be at least 0.5MP and significantly larger than our minimum
                    if (pixelCount > highestPixelCount && megapixels >= 0.5 && pixelCount > 512 * 512) {
                        bestCandidate = {
                            src: src,
                            width: img.naturalWidth || img.width,
                            height: img.naturalHeight || img.height,
                            pixelCount: pixelCount,
                            megapixels: megapixels,
                            alt: img.alt || '',
                            className: img.className || ''
                        };
                        highestPixelCount = pixelCount;
                    }
                }
                
                // Additional check: look for images in specific containers that typically hold main content
                const contentSelectors = [
                    '.main-image', '.hero-image', '.featured-image', '.post-image',
                    '.content img', '.article img', '.gallery img', '.portfolio img',
                    '[data-original]', '[data-src]'
                ];
                
                for (const selector of contentSelectors) {
                    const contentImages = document.querySelectorAll(selector);
                    for (const img of contentImages) {
                        if (img.tagName !== 'IMG') continue;
                        
                        const src = img.src || img.dataset.src || img.dataset.original;
                        if (!src || img.width < 512 || img.height < 512) continue;
                        
                        const pixelCount = (img.naturalWidth || img.width) * (img.naturalHeight || img.height);
                        const megapixels = pixelCount / 1000000;
                        
                        if (pixelCount > highestPixelCount && megapixels >= 0.5) {
                            bestCandidate = {
                                src: src,
                                width: img.naturalWidth || img.width,
                                height: img.naturalHeight || img.height,
                                pixelCount: pixelCount,
                                megapixels: megapixels,
                                alt: img.alt || '',
                                className: img.className || '',
                                fromContentArea: true
                            };
                            highestPixelCount = pixelCount;
                        }
                    }
                }
                
                return bestCandidate;
            }, originalData);
            
            if (bestImage) {
                const megapixels = (bestImage.pixelCount / 1000000).toFixed(1);
                this.logger.info(`🎯 Found high-res candidate: ${bestImage.width}x${bestImage.height} (${megapixels}MP)${bestImage.fromContentArea ? ' [content area]' : ''}`);
                return bestImage.src;
            }
            
            return null;
            
        } catch (error) {
            this.logger.warn('High-resolution search failed', { error: error.message });
            return null;
        }
    }

    async downloadEnhancedImageBatch(imageDataArray, searchTerm, targetCount = null) {
        await this.ensureInitialized();
        await this.initializeBrowser();
        
        const target = targetCount || this.googleOptions.maxResults;
        
        this.logger.info(`🐉 Starting persistent hunt: targeting ${target} GOOD images for "${searchTerm}"`);
        this.logger.info(`📏 Dragon standards: ${this.googleOptions.minWidth}x${this.googleOptions.minHeight} pixels, ${this.googleOptions.minMegapixels}MP minimum`);
        
        // EMERGENCY DEBUG: Log the actual values
        console.log('🚨 EMERGENCY DEBUG - Current standards:');
        console.log(`   minWidth: ${this.googleOptions.minWidth}`);
        console.log(`   minHeight: ${this.googleOptions.minHeight}`);
        console.log(`   minMegapixels: ${this.googleOptions.minMegapixels}`);
        console.log(`   Full googleOptions:`, this.googleOptions);
        
        const progressBar = new (require('cli-progress')).SingleBar({
            format: 'Dragon Hunt |{bar}| {percentage}% | Kept: {kept}/{target} | Processing: {value}/{total}',
            barCompleteChar: '🐉',
            barIncompleteChar: '-'
        });
        
        progressBar.start(imageDataArray.length, 0, { 
            status: 'Starting...',
            kept: 0,
            target: target
        });
        
        const results = [];
        const searchFolder = searchTerm.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        let sourceNavigationCount = 0;
        let actuallyKeptImages = 0;
        let processed = 0;
        
        // Keep hunting until we have enough good images OR run out of candidates
        while (actuallyKeptImages < target && processed < imageDataArray.length) {
            const imageData = imageDataArray[processed];
            
            try {
                progressBar.update(processed, { 
                    status: 'Enhancing...',
                    kept: actuallyKeptImages,
                    target: target
                });
                
                // Try to get full-size version
                let enhancedData = imageData;
                if (imageData.fullSizeUrl || imageData.sourcePageUrl) {
                    enhancedData = await this.navigateToSourceForFullSize(imageData);
                    if (enhancedData.resolution === 'enhanced' || enhancedData.resolution === 'ldi-full') {
                        sourceNavigationCount++;
                    }
                } else {
                    const finalUrl = this.cleanImageUrl(imageData.thumbnailUrl);
                    enhancedData = {
                        ...imageData,
                        finalImageUrl: finalUrl,
                        resolution: 'thumbnail'
                    };
                }
                
                // Skip if no valid URL
                if (!enhancedData.finalImageUrl || enhancedData.resolution === 'failed') {
                    this.logger.warn(`⏭️  Skipping image ${processed + 1}: No valid URL`);
                    results.push({
                        ...imageData,
                        error: 'No valid image URL available',
                        success: false,
                        kept: false
                    });
                    processed++;
                    continue;
                }
                
                // DISABLE PRE-DOWNLOAD VALIDATION FOR NOW - let's see what we actually get
                /*
                if (imageData.width && imageData.height) {
                    const megapixels = (imageData.width * imageData.height) / 1000000;
                    if (imageData.width < this.googleOptions.minWidth || 
                        imageData.height < this.googleOptions.minHeight ||
                        megapixels < this.googleOptions.minMegapixels) {
                        
                        this.logger.warn(`⏭️  Skipping image ${processed + 1}: Too small (${imageData.width}x${imageData.height}, ${megapixels.toFixed(1)}MP)`);
                        results.push({
                            ...imageData,
                            error: `Image too small: ${imageData.width}x${imageData.height} (${megapixels.toFixed(1)}MP)`,
                            success: false,
                            kept: false
                        });
                        processed++;
                        continue;
                    }
                }
                */
                
                // Skip thumbnails if not allowed
                if (enhancedData.resolution === 'thumbnail' && !this.googleOptions.fallbackToThumbnails) {
                    this.logger.warn(`⏭️  Skipping image ${processed + 1}: Thumbnail rejected`);
                    results.push({
                        ...imageData,
                        error: 'Thumbnail rejected - real images only',
                        success: false,
                        kept: false
                    });
                    processed++;
                    continue;
                }
                
                // Try to download
                this.logger.info(`📥 Downloading candidate ${processed + 1} (targeting keeper #${actuallyKeptImages + 1}): ${enhancedData.finalImageUrl.substring(0, 60)}...`);
                
                const extension = this.getImageExtension(enhancedData.finalImageUrl) || 'jpg';
                const filename = `${searchFolder}_${actuallyKeptImages + 1}_${enhancedData.resolution}_${Date.now()}.${extension}`;
                
                progressBar.update(processed, { 
                    status: `Downloading...`,
                    kept: actuallyKeptImages,
                    target: target
                });
                
                await this.delay(this.options.delay);
                
                const filepath = await this.downloadImage(
                    enhancedData.finalImageUrl, 
                    filename, 
                    path.join('candidates', searchFolder)
                );
                
                const metadata = await this.getImageMetadata(filepath);
                
                // TEMPORARILY DISABLE POST-DOWNLOAD VALIDATION - keep everything for now
                console.log(`🚨 DEBUG: Downloaded image ${processed + 1}: ${metadata.width}x${metadata.height} (${(metadata.width * metadata.height / 1000000).toFixed(1)}MP)`);
                
                // Post-download validation with 0.4MP standard
                if (metadata && metadata.width && metadata.height) {
                    const actualMegapixels = (metadata.width * metadata.height) / 1000000;
                    
                    if (metadata.width < this.googleOptions.minWidth || 
                        metadata.height < this.googleOptions.minHeight ||
                        actualMegapixels < this.googleOptions.minMegapixels) {
                        
                        this.logger.warn(`🗑️  Deleting: Image too small (${metadata.width}x${metadata.height}, ${actualMegapixels.toFixed(1)}MP) - below ${this.googleOptions.minWidth}x${this.googleOptions.minHeight}, ${this.googleOptions.minMegapixels}MP standards`);
                        
                        await require('fs-extra').unlink(filepath);
                        
                        results.push({
                            ...enhancedData,
                            error: `Downloaded image too small: ${metadata.width}x${metadata.height} (${actualMegapixels.toFixed(1)}MP)`,
                            success: false,
                            kept: false
                        });
                        processed++;
                        continue;
                    }
                }
                
                // SUCCESS! Keep this image (for now)
                actuallyKeptImages++;
                results.push({
                    ...enhancedData,
                    filepath: filepath,
                    metadata: metadata,
                    searchTerm: searchTerm,
                    success: true,
                    kept: true
                });
                
                this.logger.success(`✅ Keeper #${actuallyKeptImages}: ${metadata.width}x${metadata.height} (${(metadata.width * metadata.height / 1000000).toFixed(1)}MP)`);
                
            } catch (error) {
                this.logger.error(`❌ Failed to process image ${processed + 1}: ${error.message}`);
                
                results.push({
                    ...imageData,
                    error: error.message,
                    success: false,
                    kept: false
                });
            }
            
            processed++;
            progressBar.increment();
        }
        
        progressBar.stop();
        
        const resolutionStats = results.filter(r => r.kept).reduce((acc, r) => {
            acc[r.resolution] = (acc[r.resolution] || 0) + 1;
            return acc;
        }, {});
        
        if (actuallyKeptImages >= target) {
            this.logger.success(`🎯 MISSION ACCOMPLISHED! Dragons captured ${actuallyKeptImages}/${target} target images!`);
        } else {
            this.logger.warn(`⚠️  Hunt incomplete: Only ${actuallyKeptImages}/${target} images met standards (processed ${processed} candidates)`);
        }
        
        this.logger.info('📊 Resolution breakdown:', resolutionStats);
        
        return results;
    }

    async downloadImage(url, filename, subfolder = 'candidates') {
        try {
            // Ensure the full directory path exists
            const fullDirPath = path.join(this.options.downloadDir, subfolder);
            await require('fs-extra').ensureDir(fullDirPath);
            
            const response = await require('axios')({
                method: 'GET',
                url: url,
                responseType: 'stream',
                timeout: this.options.timeout,
                headers: {
                    'User-Agent': this.options.userAgent,
                    'Referer': 'https://www.google.com/'
                }
            });

            const filepath = path.join(fullDirPath, filename);
            const writer = require('fs-extra').createWriteStream(filepath);
            
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

module.exports = EnhancedGoogleImagesScraper;
#!/usr/bin/env node
// Dragon Image Scraper - Production Launcher
// "Embrace the Dragon - The hunt begins now"

const chalk = require('chalk');
const inquirer = require('inquirer');
const fs = require('fs-extra');
const path = require('path');
const EnhancedGoogleImagesScraper = require('./enhanced-google-images-scraper.js');

class DragonLauncher {
    constructor() {
        this.config = {
            version: '1.0.0',
            author: 'Dragon Team',
            lastRun: null
        };
        
        this.defaultSettings = {
            downloadDir: './dragon_downloads',
            maxResults: 50,
            minWidth: 400,  // Updated to match working enhanced scraper
            minHeight: 400, // Updated to match working enhanced scraper
            minMegapixels: 0.4, // Updated to match working enhanced scraper
            delay: 2000,
            maxSourceNavigations: 5,
            quality: 'high', // high, medium, fast
            imageType: 'photo',
            safeSearch: 'moderate'
        };
        
        this.loadConfig();
    }

    async loadConfig() {
        try {
            const configPath = './dragon_config.json';
            if (await fs.pathExists(configPath)) {
                const saved = await fs.readJson(configPath);
                this.config = { ...this.config, ...saved };
            }
        } catch (error) {
            // Use defaults if config load fails
        }
    }

    async saveConfig() {
        try {
            await fs.writeJson('./dragon_config.json', this.config, { spaces: 2 });
        } catch (error) {
            console.log(chalk.yellow('⚠️  Could not save configuration'));
        }
    }

    showDragonBanner() {
        console.clear();
        console.log(chalk.red.bold('                🐉 DRAGON IMAGE SCRAPER 🐉'));
        console.log(chalk.yellow('              "Embrace the Dragon - Hunt the Web"'));
        console.log(chalk.gray('                     Version ' + this.config.version));
        console.log(chalk.gray('═'.repeat(60)));
        console.log();
        
        if (this.config.lastRun) {
            console.log(chalk.blue(`Last hunt: ${new Date(this.config.lastRun).toLocaleDateString()}`));
            console.log();
        }
    }

    async showMainMenu() {
        const choices = [
            {
                name: '🎯 Quick Hunt - Start scraping immediately',
                value: 'quick'
            },
            {
                name: '⚙️  Advanced Hunt - Configure settings first',
                value: 'advanced'
            },
            {
                name: '📊 Analyse Previous Hunts',
                value: 'analyse'
            },
            {
                name: '🛠️  Settings & Configuration',
                value: 'settings'
            },
            {
                name: '🔬 Test & Debug Mode',
                value: 'debug'
            },
            {
                name: '❓ Help & Documentation',
                value: 'help'
            },
            {
                name: '🚪 Exit Dragon Lair',
                value: 'exit'
            }
        ];

        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'What would the dragons like to do?',
                choices: choices,
                pageSize: 10
            }
        ]);

        return action;
    }

    async quickHunt() {
        console.log(chalk.cyan('\n🎯 QUICK HUNT MODE'));
        console.log(chalk.gray('Fast setup for immediate dragon deployment\n'));

        const { searchTerm, imageCount } = await inquirer.prompt([
            {
                type: 'input',
                name: 'searchTerm',
                message: 'What shall the dragons hunt for?',
                validate: input => input.trim().length > 0 || 'Dragons need a target!'
            },
            {
                type: 'list',
                name: 'imageCount',
                message: 'How many images should the dragons capture?',
                choices: [
                    { name: 'Small hunt (10 images)', value: 10 },
                    { name: 'Medium hunt (25 images)', value: 25 },
                    { name: 'Large hunt (50 images)', value: 50 },
                    { name: 'Epic hunt (100 images)', value: 100 }
                ]
            }
        ]);

        await this.executeHunt(searchTerm, {
            ...this.defaultSettings,
            maxResults: imageCount
        });
    }

    async advancedHunt() {
        console.log(chalk.cyan('\n⚙️  ADVANCED HUNT MODE'));
        console.log(chalk.gray('Precise dragon configuration for optimal results\n'));

        const settings = await inquirer.prompt([
            {
                type: 'input',
                name: 'searchTerm',
                message: 'Dragon target (search term):',
                validate: input => input.trim().length > 0 || 'Dragons need a target!'
            },
            {
                type: 'number',
                name: 'maxResults',
                message: 'Maximum images to capture:',
                default: this.defaultSettings.maxResults,
                validate: input => input > 0 && input <= 200 || 'Between 1 and 200 images'
            },
            {
                type: 'list',
                name: 'quality',
                message: 'Hunt quality preference:',
                choices: [
                    { name: 'High Quality - Slow but thorough (navigates to sources)', value: 'high' },
                    { name: 'Balanced - Good speed and quality mix', value: 'medium' },
                    { name: 'Fast - Quick thumbnails only', value: 'fast' }
                ],
                default: this.defaultSettings.quality
            },
            {
                type: 'list',
                name: 'imageType',
                message: 'Image type preference:',
                choices: [
                    { name: 'Photos - Realistic photography', value: 'photo' },
                    { name: 'Clipart - Vector graphics and illustrations', value: 'clipart' },
                    { name: 'Line Art - Drawings and sketches', value: 'lineart' },
                    { name: 'Any - No preference', value: 'any' }
                ],
                default: this.defaultSettings.imageType
            },
            {
                type: 'number',
                name: 'minWidth',
                message: 'Minimum image width (pixels):',
                default: this.defaultSettings.minWidth,
                validate: input => input >= 256 || 'Minimum 256 pixels width'
            },
            {
                type: 'number',
                name: 'minHeight',
                message: 'Minimum image height (pixels):',
                default: this.defaultSettings.minHeight,
                validate: input => input >= 256 || 'Minimum 256 pixels height'
            },
            {
                type: 'number',
                name: 'minMegapixels',
                message: 'Minimum megapixels (0.5 = decent quality):',
                default: this.defaultSettings.minMegapixels || 0.5,
                validate: input => input >= 0.1 || 'Minimum 0.1 megapixels'
            },
            {
                type: 'list',
                name: 'safeSearch',
                message: 'Safe search level:',
                choices: [
                    { name: 'Strict - Family friendly only', value: 'strict' },
                    { name: 'Moderate - Balanced filtering', value: 'moderate' },
                    { name: 'Off - No filtering', value: 'off' }
                ],
                default: this.defaultSettings.safeSearch
            }
        ]);

        // Convert quality setting to technical parameters
        const qualitySettings = {
            high: { maxSourceNavigations: 8, delay: 3000, size: 'xlarge' },
            medium: { maxSourceNavigations: 3, delay: 2000, size: 'large' },
            fast: { maxSourceNavigations: 0, delay: 1000, size: 'medium' }
        };

        const finalSettings = {
            ...this.defaultSettings,
            ...settings,
            ...qualitySettings[settings.quality]
        };

        await this.executeHunt(settings.searchTerm, finalSettings);
    }

    async executeHunt(searchTerm, settings) {
        console.log(chalk.green.bold('\n🐉 DRAGONS DEPLOYING FOR HUNT!'));
        console.log(chalk.yellow(`Target: "${searchTerm}"`));
        console.log(chalk.blue(`Quality: ${settings.quality || 'Custom'} | Images: ${settings.maxResults} | Min Size: ${settings.minWidth}x${settings.minHeight} | Min Quality: ${settings.minMegapixels || 0.5}MP`));
        console.log();

        const startTime = Date.now();
        
        try {
            const scraper = new EnhancedGoogleImagesScraper({
                downloadDir: settings.downloadDir,
                delay: settings.delay,
                maxResults: settings.maxResults,
                minWidth: settings.minWidth,
                minHeight: settings.minHeight,
                minMegapixels: settings.minMegapixels || 0.5,
                maxSourceNavigations: settings.maxSourceNavigations,
                googleOptions: {
                    imageType: settings.imageType,
                    size: settings.size || 'large',
                    safeSearch: settings.safeSearch
                }
            });

            // Search phase
            console.log(chalk.cyan('🔍 Phase 1: Searching Google Images...'));
            const imageData = await scraper.searchGoogleImages(searchTerm, settings.maxResults);

            if (imageData.length === 0) {
                console.log(chalk.red('❌ No images found. Try different search terms or settings.'));
                return;
            }

            console.log(chalk.green(`✅ Found ${imageData.length} image candidates`));

            // Download phase
            console.log(chalk.cyan('\n📥 Phase 2: Enhanced download hunt...'));
            const results = await scraper.downloadEnhancedImageBatch(imageData, searchTerm);

            // Results analysis
            const successful = results.filter(r => r.success).length;
            const endTime = Date.now();
            const duration = ((endTime - startTime) / 1000 / 60).toFixed(1);

            console.log(chalk.green.bold('\n🎉 HUNT COMPLETE!'));
            console.log(chalk.yellow('═'.repeat(50)));
            
            console.log(chalk.blue(`📊 Results: ${successful}/${imageData.length} images captured`));
            console.log(chalk.blue(`⏱️  Duration: ${duration} minutes`));
            console.log(chalk.blue(`📁 Location: ${settings.downloadDir}`));

            // Quality breakdown
            if (successful > 0) {
                const resolutionStats = results.filter(r => r.success).reduce((acc, r) => {
                    acc[r.resolution] = (acc[r.resolution] || 0) + 1;
                    return acc;
                }, {});

                console.log(chalk.cyan('\n🔍 Resolution Breakdown:'));
                Object.entries(resolutionStats).forEach(([resolution, count]) => {
                    const emoji = this.getResolutionEmoji(resolution);
                    console.log(`  ${emoji} ${resolution}: ${count} images`);
                });

                // Show best captures
                const bestImages = results
                    .filter(r => r.success && r.metadata)
                    .sort((a, b) => b.metadata.quality - a.metadata.quality)
                    .slice(0, 3);

                if (bestImages.length > 0) {
                    console.log(chalk.green('\n🏆 Best Quality Captures:'));
                    bestImages.forEach((img, i) => {
                        const mp = (img.metadata.width * img.metadata.height / 1000000).toFixed(1);
                        console.log(`  ${i + 1}. ${img.metadata.width}x${img.metadata.height} (${mp}MP) Quality: ${img.metadata.quality}%`);
                    });
                }
            }

            // Update config
            this.config.lastRun = new Date().toISOString();
            await this.saveConfig();

            await scraper.cleanup();

        } catch (error) {
            console.error(chalk.red('\n❌ Hunt failed:'), error.message);
            if (error.stack && process.env.DEBUG) {
                console.error(chalk.gray(error.stack));
            }
        }
    }

    getResolutionEmoji(resolution) {
        const emojis = {
            'full-size': '🏆',
            'enhanced': '📈',
            'ldi-full': '🎯',
            'thumbnail': '📷'
        };
        return emojis[resolution] || '❓';
    }

    async showSettings() {
        console.log(chalk.cyan('\n🛠️  DRAGON CONFIGURATION'));
        console.log(chalk.gray('Customise dragon behaviour and preferences\n'));

        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'Configuration options:',
                choices: [
                    { name: '📁 Change default download directory', value: 'directory' },
                    { name: '⚡ Adjust default hunt parameters', value: 'parameters' },
                    { name: '🔧 Reset to factory settings', value: 'reset' },
                    { name: '📋 View current configuration', value: 'view' },
                    { name: '🔙 Back to main menu', value: 'back' }
                ]
            }
        ]);

        switch (action) {
            case 'directory':
                await this.changeDirectory();
                break;
            case 'parameters':
                await this.adjustParameters();
                break;
            case 'reset':
                await this.resetSettings();
                break;
            case 'view':
                await this.viewCurrentConfig();
                break;
            case 'back':
                return;
        }

        if (action !== 'back') {
            await this.showSettings(); // Show menu again
        }
    }

    async changeDirectory() {
        const { newDir } = await inquirer.prompt([
            {
                type: 'input',
                name: 'newDir',
                message: 'New download directory path:',
                default: this.defaultSettings.downloadDir
            }
        ]);

        this.defaultSettings.downloadDir = newDir;
        await this.saveConfig();
        console.log(chalk.green(`✅ Download directory updated to: ${newDir}`));
    }

    async adjustParameters() {
        const newSettings = await inquirer.prompt([
            {
                type: 'number',
                name: 'maxResults',
                message: 'Default maximum results:',
                default: this.defaultSettings.maxResults
            },
            {
                type: 'number',
                name: 'delay',
                message: 'Delay between requests (ms):',
                default: this.defaultSettings.delay
            },
            {
                type: 'number',
                name: 'minWidth',
                message: 'Minimum image width:',
                default: this.defaultSettings.minWidth
            },
            {
                type: 'number',
                name: 'minHeight',
                message: 'Minimum image height:',
                default: this.defaultSettings.minHeight
            }
        ]);

        Object.assign(this.defaultSettings, newSettings);
        await this.saveConfig();
        console.log(chalk.green('✅ Default parameters updated'));
    }

    async resetSettings() {
        const { confirm } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: 'Are you sure you want to reset all settings?',
                default: false
            }
        ]);

        if (confirm) {
            this.defaultSettings = {
                downloadDir: './dragon_downloads',
                maxResults: 50,
                minWidth: 800,
                minHeight: 600,
                delay: 2000,
                maxSourceNavigations: 5,
                quality: 'high',
                imageType: 'photo',
                safeSearch: 'moderate'
            };
            await this.saveConfig();
            console.log(chalk.green('✅ Settings reset to factory defaults'));
        }
    }

    async viewCurrentConfig() {
        console.log(chalk.blue('\n📋 Current Configuration:'));
        console.log(chalk.gray('─'.repeat(40)));
        
        Object.entries(this.defaultSettings).forEach(([key, value]) => {
            console.log(`  ${key}: ${value}`);
        });
        
        console.log(chalk.gray('─'.repeat(40)));
        console.log(chalk.blue(`Version: ${this.config.version}`));
        if (this.config.lastRun) {
            console.log(chalk.blue(`Last Run: ${new Date(this.config.lastRun).toLocaleString()}`));
        }
    }

    showHelp() {
        console.log(chalk.cyan('\n❓ DRAGON HELP & DOCUMENTATION'));
        console.log(chalk.gray('═'.repeat(50)));
        
        console.log(chalk.yellow('\n🎯 Quick Start:'));
        console.log('  1. Choose "Quick Hunt" for immediate results');
        console.log('  2. Enter your search term (e.g., "beautiful landscapes")');
        console.log('  3. Select how many images to capture');
        console.log('  4. Watch the dragons work their magic!');
        
        console.log(chalk.yellow('\n⚙️  Advanced Features:'));
        console.log('  • High Quality Mode: Navigates to source websites for full-resolution images');
        console.log('  • Multiple extraction methods: LDI data, script parsing, DOM analysis');
        console.log('  • Smart quality assessment and filtering');
        console.log('  • Respectful crawling with proper delays');
        
        console.log(chalk.yellow('\n🔧 Troubleshooting:'));
        console.log('  • No images found: Try different search terms or lower quality settings');
        console.log('  • Slow downloads: Reduce maxSourceNavigations or use Fast mode');
        console.log('  • Google blocking: Increase delays between requests');
        
        console.log(chalk.yellow('\n📁 File Organisation:'));
        console.log('  • Images saved to: [download_dir]/candidates/[search_term]/');
        console.log('  • Filename format: [search]_[number]_[resolution]_[timestamp].[ext]');
        console.log('  • Quality scores and metadata logged');
        
        console.log(chalk.yellow('\n🐉 Dragon Commands:'));
        console.log('  • npm run dragon      # Start the launcher');
        console.log('  • node enhanced-test.js --analyse  # Analyse downloads');
        console.log('  • DEBUG=1 npm run dragon  # Enable debug output');
        
        console.log(chalk.red.bold('\n"The dragons are always ready to hunt!"'));
    }

    async run() {
        this.showDragonBanner();
        
        while (true) {
            try {
                const action = await this.showMainMenu();
                
                switch (action) {
                    case 'quick':
                        await this.quickHunt();
                        break;
                    case 'advanced':
                        await this.advancedHunt();
                        break;
                    case 'analyse':
                        const { analyseExistingDownloads } = require('./enhanced-test.js');
                        await analyseExistingDownloads(this.defaultSettings.downloadDir);
                        break;
                    case 'settings':
                        await this.showSettings();
                        break;
                    case 'debug':
                        const { testEnhancedScraping } = require('./enhanced-test.js');
                        await testEnhancedScraping();
                        break;
                    case 'help':
                        this.showHelp();
                        break;
                    case 'exit':
                        console.log(chalk.red.bold('\n🐉 The dragons return to their lair...'));
                        console.log(chalk.yellow('Until next time, happy hunting!'));
                        process.exit(0);
                        break;
                }
                
                if (action !== 'exit') {
                    console.log(chalk.gray('\nPress Enter to continue...'));
                    await inquirer.prompt([{ type: 'input', name: 'continue', message: '' }]);
                    this.showDragonBanner();
                }
                
            } catch (error) {
                console.error(chalk.red('\n❌ Dragon error:'), error.message);
                console.log(chalk.gray('Press Enter to continue...'));
                await inquirer.prompt([{ type: 'input', name: 'continue', message: '' }]);
                this.showDragonBanner();
            }
        }
    }
}

// Launch the dragons!
if (require.main === module) {
    const launcher = new DragonLauncher();
    launcher.run().catch(console.error);
}

module.exports = DragonLauncher;
import puppeteer, { Browser, Page } from 'puppeteer';

export class FacebookScraper {
    private browser: Browser | null = null;

    async init() {
        if (!this.browser || !this.browser.isConnected()) {
            this.browser = await puppeteer.launch({
                headless: true,
                userDataDir: process.env.CHROME_PROFILE_PATH,

                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                ],
            });
        }
    }

    async scrape(city: string | null, forma?: string) {
        await this.init();

        const page = await this.browser!.newPage();

        await page.goto('https://www.facebook.com/', {
            waitUntil: 'networkidle2',
        });

        const isLoggedIn = await this.isLoggedIn(page);

        if (!isLoggedIn) {
            throw new Error(
                '❌ Not logged in. Run outside Docker first and login manually.'
            );
        }

        console.log('✅ Logged in. Starting scrape...');

        // 👉 Example: go to a group (replace with real URL)
        const groupUrl = 'https://www.facebook.com/groups/YOUR_GROUP_ID';

        await page.goto(groupUrl, { waitUntil: 'networkidle2' });

        // 👉 wait for posts
        await page.waitForSelector('[role="article"]');

        // 👉 scrape posts
        const posts = await this.extractPosts(page);

        console.log('📦 Posts:', posts);

        await page.close();

        return posts;
    }

    private async extractPosts(page: Page) {
        return await page.$$eval('[role="article"]', (elements) => {
            return elements.map((el) => {
                return (el as HTMLElement).innerText;
            });
        });
    }

    private async isLoggedIn(page: Page) {
        return await page.evaluate(() => {
            // Facebook login page has email input
            return !document.querySelector('input[name="email"]');
        });
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}
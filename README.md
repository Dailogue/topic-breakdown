# Topic Breakdown

Topic Breakdown is a web application that helps users break down complex topics into fundamental subtopics for better understanding. The application uses LLMs to generate subtopics and additional information based on user input.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fsahajsk21%2Ftopic-breakdown&env=GEMINI_API_KEY&envDescription=Gemini%20API%20key&envLink=https%3A%2F%2Fai.google.dev%2F&project-name=topic-breakdown&repository-name=topic-breakdown)

## Getting Started

First, clone the repository and navigate to the project directory:

```bash
git clone https://github.com/sahajsk21/topic-breakdown.git
cd topic-breakdown
```

Next, install the required dependencies:

```bash
npm install
```

Create a .env.local file in the root directory and add your environment variables:
Get your Gemini API key at https://aistudio.google.com/apikey.
    
```bash
GEMINI_API_KEY=<your-gemini-api-key>
```

Finally, start the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

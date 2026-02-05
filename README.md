# Debate Motion Generator

An AI-powered web application that generates compelling debate motions based on recent news and trending topics. Built with Next.js 14, Perplexity AI, and deployed on Vercel.

![Debate Motion Generator](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?style=for-the-badge&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?style=for-the-badge&logo=tailwind-css)

## Features

- **AI-Powered Generation**: Uses Perplexity AI with real-time web search to generate debate motions based on current events
- **Flexible Input**: Enter a specific topic or explore trending news automatically
- **Beautiful UI**: Modern, responsive design with smooth animations and loading states
- **Server-Side Processing**: Secure API key management with Next.js Server Actions
- **Vercel Ready**: Optimized for seamless deployment on Vercel

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js 18.x or higher
- npm or yarn package manager
- A Perplexity API key (see below)

## Getting Your Perplexity API Key

1. Visit [Perplexity AI](https://www.perplexity.ai/)
2. Sign up for an account or log in
3. Navigate to [API Settings](https://www.perplexity.ai/settings/api)
4. Generate a new API key
5. Copy the API key for use in the next section

## Local Development Setup

### 1. Clone or Download the Project

```bash
git clone <your-repo-url>
cd debate-motion-generator
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
PERPLEXITY_API_KEY=your_api_key_here
```

Replace `your_api_key_here` with your actual Perplexity API key.

**Important**: Never commit your `.env.local` file to version control. It's already included in `.gitignore`.

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Deployment to Vercel

### Option 1: Deploy via Vercel CLI

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Deploy:
```bash
vercel
```

3. Follow the prompts and add your environment variable:
   - Set `PERPLEXITY_API_KEY` when prompted

### Option 2: Deploy via Vercel Dashboard

1. Push your code to GitHub, GitLab, or Bitbucket

2. Visit [Vercel](https://vercel.com/) and sign in

3. Click "Add New Project"

4. Import your repository

5. Configure your project:
   - **Framework Preset**: Next.js
   - **Root Directory**: ./
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)

6. Add Environment Variables:
   - Click "Environment Variables"
   - Add `PERPLEXITY_API_KEY` with your API key
   - Set it for Production, Preview, and Development environments

7. Click "Deploy"

Your application will be live in minutes!

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PERPLEXITY_API_KEY` | Your Perplexity AI API key | Yes |

## Project Structure

```
debate-motion-generator/
├── app/
│   ├── actions/
│   │   └── generate-motions.ts    # Server action for Perplexity API
│   ├── globals.css                # Global styles
│   ├── layout.tsx                 # Root layout
│   └── page.tsx                   # Main page
├── components/
│   ├── ui/                        # Shadcn UI components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   └── label.tsx
│   └── motion-generator-form.tsx  # Main form component
├── lib/
│   └── utils.ts                   # Utility functions
├── types/
│   └── actions.ts                 # TypeScript type definitions
├── .env.local                     # Environment variables (create this)
├── .gitignore
├── next.config.mjs
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

## How It Works

1. **User Input**: Users can either enter a specific topic or leave it blank to explore trending news
2. **Server Action**: The form submits to a Next.js Server Action that calls the Perplexity API
3. **AI Processing**: Perplexity's Sonar model searches the web for recent news and generates 3-5 debate motions
4. **Response Parsing**: The server parses the AI response and returns structured motion data
5. **Display**: The client renders the motions in beautiful cards with categories and reasoning

## Technologies Used

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **AI Service**: Perplexity AI (Sonar model with real-time web search)
- **Styling**: Tailwind CSS
- **UI Components**: Shadcn UI (built on Radix UI)
- **Icons**: Lucide React
- **Validation**: Zod
- **Deployment**: Vercel

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Customization

### Changing the Number of Motions

Edit `app/actions/generate-motions.ts` and modify the prompt to request a different number of motions (currently set to 3-5).

### Adjusting the UI Theme

Edit `app/globals.css` to modify the color scheme. The app uses CSS variables for theming.

### Adding More Motion Categories

The AI automatically categorizes motions, but you can guide it by modifying the system prompt in `app/actions/generate-motions.ts`.

## Troubleshooting

### API Key Error

**Error**: "Perplexity API key is not configured"

**Solution**: Ensure your `.env.local` file exists with the correct variable name: `PERPLEXITY_API_KEY=your_key`

### Invalid API Key

**Error**: "Invalid Perplexity API key"

**Solution**: Verify your API key is correct and hasn't expired. Generate a new one if needed.

### No Motions Generated

**Error**: "No motions were generated"

**Solution**: The AI response may have been malformed. Try again or check your network connection.

### Build Errors on Vercel

**Solution**: 
1. Ensure all dependencies are in `package.json`
2. Check that environment variables are set in Vercel dashboard
3. Review build logs for specific errors

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the MIT License.

## Support

If you encounter any issues or have questions:
1. Check the Troubleshooting section above
2. Review the [Perplexity API Documentation](https://docs.perplexity.ai/)
3. Check [Next.js Documentation](https://nextjs.org/docs)

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- AI powered by [Perplexity](https://www.perplexity.ai/)
- UI components from [Shadcn UI](https://ui.shadcn.com/)
- Icons from [Lucide](https://lucide.dev/)

---

Made with ❤️ for the debate community


export const LEARNMATE_APP_URL = 'https://learnmate-jee.vercel.app/';

export interface RealAppScreenshot {
  id: string;
  chapterNumber?: string;
  anchorId?: string;
  title: string;
  caption: string;
  src: string;
  alt: string;
  frames?: string[];
  accentGradient: string;
  ctaLabel: string;
  href: string;
}

export const HERO_SCREENSHOT: RealAppScreenshot = {
  id: 'hero-dashboard',
  title: 'Your JEE Workspace, Reimagined.',
  caption: 'Notes, AI Tutor, 3D Labs, and NTA CBT mocks in one place.',
  src: '/screenshots/00-home-dashboard.png',
  alt: 'LearnMate JEE Home and Study Dashboard showing tasks, daily streak, Ask a Doubt, and quick materials',
  accentGradient: 'linear-gradient(135deg, #2563EB 0%, #4F46E5 50%, #7C3AED 100%)',
  ctaLabel: 'Launch LearnMate →',
  href: LEARNMATE_APP_URL,
};

export const FEATURE_CHAPTER_SCREENSHOTS: RealAppScreenshot[] = [
  {
    id: 'study-notes-tutor',
    chapterNumber: '01',
    anchorId: 'features',
    title: 'Smart Study & Notes',
    caption: 'Upload PDFs, photos, or lectures into structured KaTeX notes.',
    src: '/screenshots/01-study-notes-tutor.png',
    alt: 'LearnMate JEE Study Workbench showing structured d and f Block notes alongside the AI Tutor panel',
    accentGradient: 'linear-gradient(135deg, #2563EB 0%, #4F46E5 50%, #7C3AED 100%)',
    ctaLabel: 'Try This Feature →',
    href: LEARNMATE_APP_URL,
  },
  {
    id: 'proctored-cbt',
    chapterNumber: '02',
    anchorId: 'cbt',
    title: 'Proctored JEE CBT',
    caption: 'Authentic NTA timer, 5-state palette, and instant grading.',
    src: '/screenshots/02-proctored-cbt.png',
    alt: 'LearnMate JEE 75-question Proctored CBT Simulator with section switcher, live timer, and 5-state question palette',
    accentGradient: 'linear-gradient(135deg, #2563EB 0%, #4F46E5 50%, #7C3AED 100%)',
    ctaLabel: 'Try This Feature →',
    href: LEARNMATE_APP_URL,
  },
  {
    id: 'practice-converter',
    chapterNumber: '03',
    anchorId: 'converter',
    title: 'Offline Test → CBT',
    caption: 'Turn coaching papers or photos into timed CBT mocks.',
    src: '/screenshots/03-practice-converter.png',
    alt: 'LearnMate JEE Practice Dashboard with official shift papers, custom set builder, and mock launcher',
    accentGradient: 'linear-gradient(135deg, #7C3AED 0%, #6366F1 50%, #00A86B 100%)',
    ctaLabel: 'Try This Feature →',
    href: LEARNMATE_APP_URL,
  },
  {
    id: 'physics-studio',
    chapterNumber: '04',
    anchorId: '3d-lab',
    title: '2D & 3D Physics Studio',
    caption: 'Interactive 3D models, angle presets, and animated lessons.',
    src: '/screenshots/04-physics-studio.png',
    alt: 'LearnMate JEE Diagram and Visual Studio showing an inclined plane free-body diagram with angle and force presets',
    accentGradient: 'linear-gradient(135deg, #7C3AED 0%, #6366F1 50%, #00A86B 100%)',
    ctaLabel: 'Try This Feature →',
    href: LEARNMATE_APP_URL,
  },
  {
    id: 'progress-heatmap',
    chapterNumber: '05',
    anchorId: 'progress',
    title: 'Voice Tutor & 58-Chapter Progress',
    caption: 'Hinglish, Hindi, and English voice tutoring with chapter mastery.',
    src: '/screenshots/05-progress-heatmap.png',
    alt: 'LearnMate JEE Progress Dashboard showing Physics, Chemistry, and Mathematics mastery alongside chapter accuracy breakdown',
    accentGradient: 'linear-gradient(135deg, #2563EB 0%, #6366F1 50%, #00A86B 100%)',
    ctaLabel: 'Try This Feature →',
    href: LEARNMATE_APP_URL,
  },
];

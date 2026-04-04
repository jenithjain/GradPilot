import { getImageModel } from './gemini';

interface VariantSpec {
  key: string;
  theme: string;
  aspect: string; // guidance, not enforced
  lens: string;
  lighting: string;
  color: string;
  mood: string;
  styleRefs: string[];
  negative: string[];
}

// Predefined variant specs to force strong differentiation
const VARIANTS: VariantSpec[] = [
  {
    key: 'minimal_modern',
    theme: 'Minimalist Clean & Modern',
    aspect: '4:5 portrait',
    lens: '50mm prime, shallow depth of field',
    lighting: 'soft diffused studio light, gentle falloff',
    color: 'neutral palette, whites, soft grays, subtle accent color',
    mood: 'calm, refined, balanced negative space',
    styleRefs: ['contemporary editorial', 'Scandinavian product layout'],
    negative: ['busy background', 'harsh shadows', 'overexposure', 'text distortion']
  },
  {
    key: 'vibrant_pop',
    theme: 'Vibrant Pop Art & Bold Colors',
    aspect: '1:1 square',
    lens: '24mm wide, crisp focus',
    lighting: 'punchy high-key lighting with controlled highlights',
    color: 'bold contrasting palette (teal vs coral, magenta vs yellow)',
    mood: 'energetic, playful, high-impact',
    styleRefs: ['pop-art poster', 'bold packaging campaign'],
    negative: ['muddy colors', 'low contrast', 'muted saturation', 'blurry text']
  },
  {
    key: 'organic_natural',
    theme: 'Natural Organic & Earthy',
    aspect: '16:9 landscape',
    lens: '35mm environmental',
    lighting: 'warm golden hour with soft rim highlights',
    color: 'earth tones (sage, terracotta, oat, moss)',
    mood: 'grounded, wholesome, sustainable authenticity',
    styleRefs: ['lifestyle documentary', 'artisan brand photography'],
    negative: ['plastic sheen', 'neon colors', 'artificial feel', 'sterile look']
  },
  {
    key: 'luxury_dark',
    theme: 'Luxury Dark & Monochrome',
    aspect: '9:16 vertical',
    lens: '85mm portrait, compressed perspective',
    lighting: 'dramatic low-key with controlled specular highlights',
    color: 'rich blacks, charcoal, subtle metallic accent (gold or platinum)',
    mood: 'elevated, exclusive, premium allure',
    styleRefs: ['luxury fragrance campaign', 'cinematic commercial still'],
    negative: ['flat lighting', 'washed out blacks', 'oversaturation', 'cluttered frame']
  }
];

export interface GeneratedImageMeta {
  file: string;
  url: string;
  theme: string;
  aspect: string;
  lens: string;
  lighting: string;
  color: string;
  mood: string;
}

// Build a rich prompt for a variant
function buildVariantPrompt(basePrompt: string, v: VariantSpec): string {
  return `${basePrompt}\n\nIMAGE VARIANT SPEC (${v.key.toUpperCase()}):\nTheme: ${v.theme}\nDesired Aspect Ratio: ${v.aspect} (if supported)\nLens & Optics: ${v.lens}\nLighting: ${v.lighting}\nColor Direction: ${v.color}\nMood & Atmosphere: ${v.mood}\nArt / Style References: ${v.styleRefs.join(', ')}\nComposition Guidance: Emphasize hierarchy, product clarity, and intentional focal points.\nTypography Overlay: Provide clean space for headline + subline + CTA, avoid distortion.\nTechnical Quality: Ultra sharp subject, clean edges, natural gradients, no artifacts.\nNegative / Avoid: ${v.negative.join(', ')}\nReturn ONLY the raw image. No captions, no explanation.`;
}

// Generate four images with structured variant prompts
export async function generateCampaignImages(basePrompt: string) {
  const model = getImageModel();
  const outputs: { meta: Omit<GeneratedImageMeta,'file'|'url'>; data: string; mimeType: string }[] = [];

  for (const variant of VARIANTS) {
    const prompt = buildVariantPrompt(basePrompt, variant);
    const result: any = await model.generateContent(prompt);
    const response: any = await result.response;
    const parts = response.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p: any) => p?.inlineData?.mimeType?.startsWith('image/'));
    if (!imagePart) {
      continue; // skip if no image returned
    }
    outputs.push({
      meta: {
        theme: variant.theme,
        aspect: variant.aspect,
        lens: variant.lens,
        lighting: variant.lighting,
        color: variant.color,
        mood: variant.mood,
      },
      data: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType,
    });
  }

  return outputs;
}

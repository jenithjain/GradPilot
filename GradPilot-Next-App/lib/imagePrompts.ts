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

// Predefined variant specs — unified professional social media style with subtle variations
const VARIANTS: VariantSpec[] = [
  {
    key: 'hero_post',
    theme: 'Professional Social Media Hero Post',
    aspect: '1:1 square',
    lens: '35mm, sharp focus, clean composition',
    lighting: 'bright natural light with soft fill, airy and inviting',
    color: 'consistent brand palette — deep navy (#1a365d), warm gold (#d4a853), clean white, light sky blue accents',
    mood: 'aspirational, professional, welcoming — like a top-tier education brand Instagram post',
    styleRefs: ['professional Instagram carousel post', 'education brand social media', 'Canva pro template style'],
    negative: ['collage layout', 'split panels', 'multiple scenes', 'busy background', 'stock photo feel', 'text distortion', 'cartoon style', 'illustration style', 'watermark']
  },
  {
    key: 'testimonial_card',
    theme: 'Student Success / Testimonial Card',
    aspect: '1:1 square',
    lens: '50mm portrait, shallow depth of field on subject',
    lighting: 'warm studio lighting, gentle gradient background',
    color: 'consistent brand palette — deep navy (#1a365d), warm gold (#d4a853), clean white, soft cream background',
    mood: 'trustworthy, personal, success-oriented — like a student success story post',
    styleRefs: ['LinkedIn announcement post', 'education testimonial card', 'professional social proof design'],
    negative: ['collage layout', 'split panels', 'multiple scenes', 'cluttered frame', 'harsh shadows', 'neon colors', 'illustration style', 'cartoon style']
  },
  {
    key: 'info_graphic',
    theme: 'Clean Infographic / Stats Highlight',
    aspect: '1:1 square',
    lens: '50mm, flat lay perspective, clean grid',
    lighting: 'even flat lighting, no harsh shadows',
    color: 'consistent brand palette — deep navy (#1a365d), warm gold (#d4a853), white background, teal accent (#0d9488)',
    mood: 'informative, clean, data-driven — like a professional education statistics post',
    styleRefs: ['social media infographic', 'education stats carousel', 'modern flat design with photography'],
    negative: ['collage layout', 'split panels', 'multiple unrelated scenes', 'vintage filter', 'grunge texture', 'hand-drawn style', 'clipart']
  },
  {
    key: 'cta_banner',
    theme: 'Call-to-Action Banner / Promo Post',
    aspect: '1:1 square',
    lens: '24mm wide, environmental context, campus or travel backdrop',
    lighting: 'golden hour warmth with soft bokeh background',
    color: 'consistent brand palette — deep navy (#1a365d), warm gold (#d4a853), emerald green (#059669), white text overlays',
    mood: 'urgent, motivating, action-oriented — like a limited-time offer education post',
    styleRefs: ['Instagram ad creative', 'Facebook sponsored education post', 'professional CTA banner'],
    negative: ['collage layout', 'split panels', 'multiple scenes', 'low quality', 'blurry', 'oversaturated', 'meme style', 'clip art']
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
  return `${basePrompt}\n\nIMAGE VARIANT SPEC (${v.key.toUpperCase()}):\nTheme: ${v.theme}\nDesired Aspect Ratio: ${v.aspect} (if supported)\nLens & Optics: ${v.lens}\nLighting: ${v.lighting}\nColor Direction: ${v.color}\nMood & Atmosphere: ${v.mood}\nArt / Style References: ${v.styleRefs.join(', ')}\nComposition Guidance: Single cohesive scene (NOT a collage or grid). One clean focal point, professional social media post layout with space for text overlay.\nTypography Overlay: Provide clean space for headline + subline + CTA, avoid distortion.\nCRITICAL STYLE RULES:\n- Generate a SINGLE unified image, NOT a collage, NOT a grid, NOT multiple panels\n- Professional social media marketing style (like Instagram/LinkedIn ad creatives)\n- Consistent brand feel across all variants — same color family, same professional tone\n- Photorealistic with clean modern design elements\nTechnical Quality: Ultra sharp subject, clean edges, natural gradients, no artifacts.\nNegative / Avoid: ${v.negative.join(', ')}\nReturn ONLY the raw image. No captions, no explanation.`;
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

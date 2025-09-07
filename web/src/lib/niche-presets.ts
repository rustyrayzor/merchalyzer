import type {
  IdeogramAspectRatio,
  IdeogramMagicPrompt,
  IdeogramRenderingSpeed,
  IdeogramStyleType,
} from './ideogram';

export interface NichePreset {
  primary: string;
  sub?: string;
  tone?: string;
  tshirtStyle?: string;
  styleDetails?: string;
  ideogram?: Partial<{
    aspect_ratio: IdeogramAspectRatio;
    rendering_speed: IdeogramRenderingSpeed;
    magic_prompt: IdeogramMagicPrompt;
    style_type: IdeogramStyleType;
    negative_prompt: string;
    seed: number;
  }>;
}

// Christian sub‑niche presets
const CHRISTIAN_SUB_PRESETS: Record<string, NichePreset> = {
  'Christian Humor': {
    primary: 'Christian',
    sub: 'Christian Humor',
    tone: 'Funny',
    tshirtStyle: 'Bold Sans Typography',
    styleDetails:
      'High‑contrast bold all‑caps or playful stacked type, clean outline or soft drop shadow; small cross/star accents; crisp vector edges; centered chest composition; light, wholesome humor.',
    ideogram: { style_type: 'DESIGN' },
  },
  'Christian Sarcasm Humour': {
    primary: 'Christian',
    sub: 'Christian Sarcasm Humour',
    tone: 'Sarcastic',
    tshirtStyle: 'Bold Sans Typography',
    styleDetails:
      'Bold condensed or heavy sans with tight kerning, arched/stacked layout; punchy outline; minimal iconography (small cross/glyph). Keep sarcasm gentle and respectful; crisp vector presentation.',
    ideogram: { style_type: 'DESIGN' },
  },
  'Worship & Music Ministry': {
    primary: 'Christian',
    sub: 'Worship & Music Ministry',
    tone: 'Inspirational',
    tshirtStyle: 'Hand‑Lettered Script',
    styleDetails:
      'Flowing hand‑lettered script with subtle music notes and staff lines; gentle halo/glow accents; centered stacked composition; clean vector shapes, high legibility.',
    ideogram: { style_type: 'DESIGN' },
  },
  'Motherhood & Fatherhood': {
    primary: 'Christian',
    sub: 'Motherhood & Fatherhood',
    tone: 'Friendly',
    tshirtStyle: 'Vintage Distressed',
    styleDetails:
      'Warm textured vintage type with gentle distress; small heart/leaf flourishes; balanced stacked layout; friendly tone; crisp vector edges under light distress.',
    ideogram: { style_type: 'DESIGN' },
  },
  'Youth Ministry & Gen Z Faith': {
    primary: 'Christian',
    sub: 'Youth Ministry & Gen Z Faith',
    tone: 'Youthful',
    tshirtStyle: 'Y2K',
    styleDetails:
      'Sticker‑style bubbly shapes, neon gradients, subtle chrome/rim light; bold central stack with playful icons; crisp linework; centered T‑shirt composition.',
    ideogram: { style_type: 'DESIGN' },
  },
  'Marriage & Relationships': {
    primary: 'Christian',
    sub: 'Marriage & Relationships',
    tone: 'Elegant',
    tshirtStyle: 'Hand‑Lettered Script',
    styleDetails:
      'Graceful script with fine line flourishes and soft serif subtext; light ornaments; centered balanced composition; clean vector lines; refined palette.',
    ideogram: { style_type: 'DESIGN' },
  },
  'Sports & Fitness with Faith': {
    primary: 'Christian',
    sub: 'Sports & Fitness with Faith',
    tone: 'Bold',
    tshirtStyle: 'Sports Jersey',
    styleDetails:
      'Varsity slab letterforms with numbers/stripes motifs and chevrons; bold outline; high legibility; central crest layout; crisp vector edges.',
    ideogram: { style_type: 'DESIGN' },
  },
  'Southern & Country Christian Culture': {
    primary: 'Christian',
    sub: 'Southern & Country Christian Culture',
    tone: 'Vintage',
    tshirtStyle: 'Vintage Distressed',
    styleDetails:
      'Western serif/slab, rope or star accents, aged texture; warm retro palette; centered stacked layout; readable distressed type with clean base vectors.',
    ideogram: { style_type: 'DESIGN' },
  },
  'Parenting & Family Life': {
    primary: 'Christian',
    sub: 'Parenting & Family Life',
    tone: 'Friendly',
    tshirtStyle: 'Minimalist Line Art',
    styleDetails:
      'Simple mono‑weight line icons (hearts, hands), open spacing, soft rounded sans subtext; balanced centered layout; clean vector lines.',
    ideogram: { style_type: 'DESIGN' },
  },
  'Christian Pets & Animals': {
    primary: 'Christian',
    sub: 'Christian Pets & Animals',
    tone: 'Playful',
    tshirtStyle: 'Cartoon Mascot',
    styleDetails:
      'Rounded character shapes with cute expressions; minimal text framing; bold outlines with flat fills; charming icons (paws, doves) in center layout.',
    ideogram: { style_type: 'DESIGN' },
  },
  'Church Fellowship & Potlucks': {
    primary: 'Christian',
    sub: 'Church Fellowship & Potlucks',
    tone: 'Friendly',
    tshirtStyle: 'Retro 70s',
    styleDetails:
      'Rounded retro letterforms, warm oranges/browns, soft inset shadows; subtle food/community motifs; centered composition; crisp vector shapes.',
    ideogram: { style_type: 'DESIGN' },
  },
  'Christian Streetwear / Minimalist Aesthetic': {
    primary: 'Christian',
    sub: 'Christian Streetwear / Minimalist Aesthetic',
    tone: 'Edgy',
    tshirtStyle: 'Grunge Streetwear',
    styleDetails:
      'Heavy condensed sans with subtle grunge texture; tight kerning; small cross/glyph; monochrome or muted palette; centered stack; clean underlying vectors.',
    ideogram: { style_type: 'DESIGN' },
  },
  'Christian Patriot / Pro-Freedom Faith': {
    primary: 'Christian',
    sub: 'Christian Patriot / Pro-Freedom Faith',
    tone: 'Bold',
    tshirtStyle: 'Bold Sans Typography',
    styleDetails:
      'Tall bold sans, subtle flag/star stripes as negative space; strong outline; centered chest stack; emphatic yet clean vector presentation.',
    ideogram: { style_type: 'DESIGN' },
  },
  'Bible Journaling & Scripture Art': {
    primary: 'Christian',
    sub: 'Bible Journaling & Scripture Art',
    tone: 'Inspirational',
    tshirtStyle: 'Hand‑Lettered Script',
    styleDetails:
      'Calligraphic script with gentle flourishes, thin underline swashes, leaf/dove accents; centered layout; crisp vector lines; reverent tone.',
    ideogram: { style_type: 'DESIGN' },
  },
  'Christian Mental Health & Positivity': {
    primary: 'Christian',
    sub: 'Christian Mental Health & Positivity',
    tone: 'Inspirational',
    tshirtStyle: 'Minimalist Line Art',
    styleDetails:
      'Soothing open composition; soft rounded sans subtext; simple icons (sunrise, heart); calm palette; centered layout; clean vector lines.',
    ideogram: { style_type: 'DESIGN' },
  },
};

export function getNichePreset(primary: string, sub?: string): NichePreset | null {
  const p = (primary || '').trim().toLowerCase();
  const s = (sub || '').trim();
  if (p !== 'christian' || !s) return null;
  return CHRISTIAN_SUB_PRESETS[s] || null;
}

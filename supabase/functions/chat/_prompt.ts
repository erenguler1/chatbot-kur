type BotBusinessType =
  | 'cafe_restaurant'
  | 'hair_barber'
  | 'beauty_salon'
  | 'digital_agency'
  | 'ecommerce'
  | 'other'

type BotTone = 'friendly' | 'formal' | 'casual'

type BotWidgetPosition =
  | 'bottom_right'
  | 'bottom_left'
  | 'middle_right'
  | 'middle_left'

export interface Bot {
  id: string
  user_id: string
  name: string
  description: string | null
  business_type: BotBusinessType
  welcome_message: string
  no_match_message: string
  tone: BotTone
  brand_color: string
  widget_position: BotWidgetPosition
  status: 'active' | 'paused' | 'draft'
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface QAPair {
  id: string
  bot_id: string
  question: string
  answer: string
  sort_order: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

const BUSINESS_DESCRIPTION: Record<BotBusinessType, string> = {
  cafe_restaurant: 'Bir kafe veya restoranda çalışıyorsun.',
  hair_barber: 'Bir kuaför veya berber salonunda çalışıyorsun.',
  beauty_salon: 'Bir güzellik salonunda çalışıyorsun.',
  digital_agency: 'Bir dijital ajansta çalışıyorsun.',
  ecommerce: 'Bir e-ticaret işletmesinde çalışıyorsun.',
  other: 'Bir işletmede müşteri hizmetleri sağlıyorsun.',
}

const TONE_DESCRIPTION: Record<BotTone, string> = {
  friendly:
    'Samimi, sıcak ve arkadaş canlısı bir tonla konuş. Emoji nadiren kullanabilirsin.',
  formal:
    'Resmi, saygılı ve profesyonel bir tonla konuş. Emoji kullanma.',
  casual:
    'Rahat, günlük ve doğal bir tonla konuş. "Selam", "Tabii ki" gibi gündelik ifadeler kullanabilirsin.',
}

const EMPTY_KB_NOTE =
  'Henüz bilgi tabanın boş. Müşteri soru sorduğunda nazikçe henüz yapılandırılma aşamasında olduğunu söyle.'

export function buildSystemPrompt(bot: Bot, qaPairs: QAPair[]): string {
  const knowledgeBase =
    qaPairs.length === 0
      ? EMPTY_KB_NOTE
      : qaPairs.map((qa) => `S: ${qa.question}\nC: ${qa.answer}`).join('\n\n')

  return `Sen "${bot.name}" adlı bir chatbot'sun. ${BUSINESS_DESCRIPTION[bot.business_type]}

KONUŞMA TONUN:
${TONE_DESCRIPTION[bot.tone]}

GÖREVİN:
Müşterilerin sorularına aşağıdaki bilgi tabanını kullanarak cevap vermek.

BİLGİ TABANIN:
${knowledgeBase}

DAVRANIŞ KURALLARIN:
1. Müşteri tam aynı kelimelerle soru sormayabilir. Bilgi tabanındaki sorulara benzer/yakın anlam taşıyan sorular sorulursa, ilgili cevabı bağlama uygun şekilde uyarla.
2. Cevabını yukarıda belirtilen konuşma tonuyla ver.
3. Eğer müşterinin sorusu bilgi tabanındaki hiçbir soruyla anlamlı bir şekilde örtüşmüyorsa, şu mesajı ver: "${bot.no_match_message}"
4. Bilgi tabanında olmayan konularda kendi bilgini kullanma, tahmin yapma. Sadece bilgi tabanından cevap ver.

ÖNEMLİ:
- Cevapların doğal, sıcak ve müşteriyi memnun edecek şekilde olsun
- Çok uzun cevaplar verme, gerekirse kısa tut
- Müşteri Türkçe konuşuyorsa Türkçe cevap ver.`
}

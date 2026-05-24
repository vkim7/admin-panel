import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary, isValidLocale } from "@/lib/i18n";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale = isValidLocale(lang) ? lang : "uz";
  const isRu = locale === "ru";
  return {
    title: isRu
      ? "Политика конфиденциальности — Banana School"
      : "Maxfiylik siyosati — Banana School",
    robots: { index: false },
  };
}

function UzbekPolicy() {
  return (
    <article className="space-y-8 text-[15px] leading-relaxed text-foreground/80">
      <div>
        <h1 className="font-heading font-black text-[clamp(24px,4vw,36px)] text-foreground tracking-[-1px] leading-[1.1] mb-2">
          Maxfiylik siyosati
        </h1>
        <p className="text-sm text-foreground/40">So'nggi yangilanish: 2026-yil 24-may</p>
      </div>

      <section className="space-y-2">
        <h2 className="font-heading font-black text-lg text-foreground">1. Ma'lumot to'plovchi tashkilot</h2>
        <p>
          Banana School (<a href="https://bananaschool.uz" className="font-semibold underline underline-offset-2">bananaschool.uz</a>) — O'zbekistonda online ingliz tili ta'limi xizmati.
          Ushbu siyosat saytimizga tashrif buyuruvchilar va ariza topshiruvchilarning shaxsiy ma'lumotlari qanday to'planishi, ishlatilishi va himoyalanishi haqida ma'lumot beradi.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading font-black text-lg text-foreground">2. Qanday ma'lumotlar to'planadi</h2>
        <p>Saytimizda ariza topshirganingizda quyidagi ma'lumotlarni so'raymiz:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Ism va familiya</li>
          <li>Telefon raqam</li>
          <li>Tug'ilgan sana (ixtiyoriy)</li>
          <li>Ingliz tili darajasi va dars formati bo'yicha imtiyoz</li>
        </ul>
        <p>
          Bundan tashqari, saytimiz standart texnik ma'lumotlarni (IP-manzil, brauzer turi, sahifaga kirish vaqti) avtomatik ravishda qayd etadi.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading font-black text-lg text-foreground">3. Ma'lumotlar qanday ishlatiladi</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Ariza bo'yicha siz bilan bog'lanish va ta'lim xizmatlarini taklif qilish uchun</li>
          <li>Meta (Facebook/Instagram) reklama platformasi orqali maqsadli reklama ko'rsatish uchun</li>
          <li>Sayt ishlashini tahlil qilish uchun (Google Analytics, Yandex.Metrika)</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading font-black text-lg text-foreground">4. Uchinchi tomon hamkorlari</h2>
        <p>Biz quyidagi tashkilotlar bilan ma'lumot almashishimiz mumkin:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><span className="font-semibold">Meta Platforms, Inc.</span> — Facebook va Instagram reklamalari uchun</li>
          <li><span className="font-semibold">Google LLC</span> — sayt tahlili uchun (Google Analytics)</li>
          <li><span className="font-semibold">Yandex LLC</span> — sayt tahlili uchun (Yandex.Metrika)</li>
          <li>
            <span className="font-semibold">Cloudflare, Inc.</span> — formalarni botlardan himoya qilish uchun (Turnstile).{" "}
            <a
              href="https://www.cloudflare.com/turnstile-privacy-policy/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              Cloudflare Turnstile maxfiylik qo'shimchasi
            </a>
            .
          </li>
        </ul>
        <p>
          Ushbu tashkilotlar o'zlarining maxfiylik siyosatlariga muvofiq ma'lumotlarni qayta ishlaydi. Biz ma'lumotlaringizni uchinchi tomonlarga sotmaymiz.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading font-black text-lg text-foreground">5. 18 yoshgacha bo'lganlar</h2>
        <p>
          Bizning xizmatimiz 13 yoshdan katta o'quvchilarga mo'ljallangan. Agar siz 18 yoshdan kichik bo'lsangiz,
          ota-onangiz yoki qonuniy vasiyingiz ushbu maxfiylik siyosatini o'qib chiqib, sizning nomingizdan rozilik
          bergan bo'lishi kerak. Ota-onalar farzandining ma'lumotlarini o'chirish yoki tahrirlash uchun biz bilan
          bog'lanishi mumkin.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading font-black text-lg text-foreground">6. Ma'lumotlarni saqlash</h2>
        <p>
          Shaxsiy ma'lumotlaringiz himoyalangan serverda saqlanadi. Ma'lumotlar xizmatni taqdim etish uchun zarur
          bo'lgan muddatda yoki o'chirish so'rovi kelgunga qadar saqlanadi.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading font-black text-lg text-foreground">7. Huquqlaringiz</h2>
        <p>
          Siz ma'lumotlaringizni ko'rish, tuzatish yoki o'chirish huquqiga egasiz.
          Buning uchun quyidagi aloqa ma'lumotlari orqali biz bilan bog'laning — biz so'rovni qo'lda bajaramiz.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading font-black text-lg text-foreground">8. Aloqa</h2>
        <p>Savol yoki so'rovlar uchun:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Telegram: <a href="https://t.me/bananaschool_uz" className="font-semibold underline underline-offset-2">@bananaschool_uz</a></li>
          <li>Telefon: <a href="tel:+998979798808" className="font-semibold underline underline-offset-2">+998 97 979 88 08</a></li>
        </ul>
      </section>
    </article>
  );
}

function RussianPolicy() {
  return (
    <article className="space-y-8 text-[15px] leading-relaxed text-foreground/80">
      <div>
        <h1 className="font-heading font-black text-[clamp(24px,4vw,36px)] text-foreground tracking-[-1px] leading-[1.1] mb-2">
          Политика конфиденциальности
        </h1>
        <p className="text-sm text-foreground/40">Последнее обновление: 24 мая 2026 г.</p>
      </div>

      <section className="space-y-2">
        <h2 className="font-heading font-black text-lg text-foreground">1. Оператор данных</h2>
        <p>
          Banana School (<a href="https://bananaschool.uz" className="font-semibold underline underline-offset-2">bananaschool.uz</a>) — онлайн-школа английского языка в Узбекистане.
          Настоящая политика описывает, как мы собираем, используем и защищаем персональные данные
          посетителей сайта и лиц, оставляющих заявки.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading font-black text-lg text-foreground">2. Какие данные мы собираем</h2>
        <p>При подаче заявки на нашем сайте мы запрашиваем:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Имя и фамилию</li>
          <li>Номер телефона</li>
          <li>Дату рождения (необязательно)</li>
          <li>Предпочтения по уровню английского и формату занятий</li>
        </ul>
        <p>
          Кроме того, сайт автоматически фиксирует стандартные технические данные (IP-адрес, тип браузера, время визита).
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading font-black text-lg text-foreground">3. Как используются данные</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Для связи с вами по заявке и предоставления информации об образовательных услугах</li>
          <li>Для показа целевой рекламы через Meta (Facebook/Instagram)</li>
          <li>Для анализа работы сайта (Google Analytics, Яндекс.Метрика)</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading font-black text-lg text-foreground">4. Третьи стороны</h2>
        <p>Мы можем передавать данные следующим организациям:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><span className="font-semibold">Meta Platforms, Inc.</span> — для показа рекламы в Facebook и Instagram</li>
          <li><span className="font-semibold">Google LLC</span> — для аналитики сайта (Google Analytics)</li>
          <li><span className="font-semibold">Yandex LLC</span> — для аналитики сайта (Яндекс.Метрика)</li>
          <li>
            <span className="font-semibold">Cloudflare, Inc.</span> — для защиты форм от ботов (Turnstile). См.{" "}
            <a
              href="https://www.cloudflare.com/turnstile-privacy-policy/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              дополнение Cloudflare к политике Turnstile
            </a>
            .
          </li>
        </ul>
        <p>
          Перечисленные организации обрабатывают данные в соответствии со своими политиками конфиденциальности.
          Мы не продаём ваши данные третьим лицам.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading font-black text-lg text-foreground">5. Лица до 18 лет</h2>
        <p>
          Наши услуги предназначены для учеников от 13 лет. Если вам нет 18 лет, ваш родитель или законный
          опекун должен ознакомиться с настоящей политикой и дать согласие от вашего имени. Родители
          вправе обратиться к нам для просмотра, исправления или удаления данных своего ребёнка.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading font-black text-lg text-foreground">6. Хранение данных</h2>
        <p>
          Ваши персональные данные хранятся на защищённых серверах. Данные сохраняются в течение срока,
          необходимого для оказания услуги, либо до поступления запроса об удалении.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading font-black text-lg text-foreground">7. Ваши права</h2>
        <p>
          Вы вправе просмотреть, исправить или удалить свои данные.
          Для этого свяжитесь с нами по контактам ниже — запрос будет выполнен вручную.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading font-black text-lg text-foreground">8. Контакты</h2>
        <p>По вопросам и запросам:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Telegram: <a href="https://t.me/bananaschool_uz" className="font-semibold underline underline-offset-2">@bananaschool_uz</a></li>
          <li>Телефон: <a href="tel:+998979798808" className="font-semibold underline underline-offset-2">+998 97 979 88 08</a></li>
        </ul>
      </section>
    </article>
  );
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = isValidLocale(lang) ? lang : "uz";
  const dict = await getDictionary(locale);
  const isRu = locale === "ru";

  return (
    <>
      <Nav dict={dict.nav} locale={locale} />
      <main className="bg-background">
        <div className="max-w-[720px] mx-auto px-6 py-12 md:py-20">
          <Link
            href={`/${locale}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground/40 hover:text-foreground mb-10 transition-colors"
          >
            ← {isRu ? "На главную" : "Bosh sahifaga"}
          </Link>
          {isRu ? <RussianPolicy /> : <UzbekPolicy />}
        </div>
      </main>
      <Footer locale={locale} />
    </>
  );
}

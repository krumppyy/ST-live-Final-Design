import type { LocaleCode } from '../types';

export interface LocaleMeta {
  code: LocaleCode;
  nativeName: string;
  englishName: string;
  rtl?: boolean;
}

export const LOCALES: LocaleMeta[] = [
  { code: 'en', nativeName: 'English', englishName: 'English' },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi' },
  { code: 'bn', nativeName: 'বাংলা', englishName: 'Bengali' },
  { code: 'es', nativeName: 'Español', englishName: 'Spanish' },
  { code: 'ar', nativeName: 'العربية', englishName: 'Arabic', rtl: true },
  { code: 'ja', nativeName: '日本語', englishName: 'Japanese' },
];

type TranslationKeys = {
  navLive: string;
  navGames: string;
  navCamera: string;
  navWorkspace: string;
  signIn: string;
  signOut: string;
  preferences: string;
  searchPlaceholder: string;
  homeHeading: string;
  homeSubheading: string;
  catAll: string;
  catSolo: string;
  catMultiGuest: string;
  catAudio: string;
  catPK: string;
  catGames: string;
  catMusicBand: string;
  catGaming: string;
  catBrandDrop: string;
  viewers: string;
  seats: string;
  noStreams: string;
  clearFilters: string;
  backToLive: string;
  sendMessage: string;
  chatPlaceholder: string;
  sendGift: string;
  multiGuestSeats: string;
  joinSeat: string;
  leaveSeat: string;
  pkBattle: string;
  startPK: string;
  endPK: string;
  openLiveGame: string;
  loginTitle: string;
  loginSubtitle: string;
  createAccount: string;
  roleGuest: string;
  roleHost: string;
  roleAdmin: string;
  roleAgency: string;
  roleBand: string;
  continueAsGuest: string;
  uidLabel: string;
  displayNameLabel: string;
  passwordLabel: string;
  hostAdminPasswordLabel: string;
  hostUidOptional: string;
  adminLoginHint: string;
  cameraTitle: string;
  cameraSubtitle: string;
  capturePhoto: string;
  startRecording: string;
  stopRecording: string;
  burstShot: string;
  teleprompter: string;
  gallery: string;
  gamesTitle: string;
  gamesSubtitle: string;
  requestJoin: string;
  requestPending: string;
  approvedSeat: string;
  hostApprovalQueue: string;
  approve: string;
  decline: string;
  rollDice: string;
  addBot: string;
  restartMatch: string;
  spectatingNote: string;
  workspaceTitle: string;
  promoteAdmin: string;
  assignTask: string;
  assignedTasks: string;
  comparePlatforms: string;
  themeMode: string;
  darkMode: string;
  lightMode: string;
  colorGrade: string;
  languageLabel: string;
  fontFamily: string;
  fontSize: string;
  deviceSafeArea: string;
  installApp: string;
};

const EN: TranslationKeys = {
  navLive: 'Discover',
  navGames: 'Games',
  navCamera: 'Camera',
  navWorkspace: 'Studio',
  signIn: 'Sign In',
  signOut: 'Sign Out',
  preferences: 'Themes & OS',
  searchPlaceholder: 'Search live rooms, hosts, bands, or multiplayer games...',
  homeHeading: 'StreamLive',
  homeSubheading: '',
  catAll: 'All Live',
  catSolo: 'Solo Video',
  catMultiGuest: 'Multi-Guest',
  catAudio: 'Audio Rooms',
  catPK: 'PK Battles',
  catGames: 'Live Games',
  catMusicBand: 'Music & Bands',
  catGaming: 'Gaming',
  catBrandDrop: 'Brand Drops',
  viewers: 'watching',
  seats: 'seats',
  noStreams: 'No active streams match your search right now.',
  clearFilters: 'Reset filters',
  backToLive: 'Back to Live',
  sendMessage: 'Send',
  chatPlaceholder: 'Write a message...',
  sendGift: 'Send Gift',
  multiGuestSeats: 'Multi-Guest Stage',
  joinSeat: 'Take Seat',
  leaveSeat: 'Leave Seat',
  pkBattle: 'PK Battle',
  startPK: 'Start PK',
  endPK: 'End PK',
  openLiveGame: 'Open Room Game',
  loginTitle: 'Unified STLive Sign In',
  loginSubtitle: 'One portal for Guests, Hosts, Host-assigned Admins, Agencies, and Bands.',
  createAccount: 'Create Account',
  roleGuest: 'Guest',
  roleHost: 'Host',
  roleAdmin: 'Admin',
  roleAgency: 'Agency',
  roleBand: 'Bands / Brands',
  continueAsGuest: 'Instant Guest Entry',
  uidLabel: 'User UID',
  displayNameLabel: 'Display Name',
  passwordLabel: 'Password',
  hostAdminPasswordLabel: 'Host-Provided Admin Password',
  hostUidOptional: 'Assigning Host UID (optional)',
  adminLoginHint: 'Promoted by a Host? Sign in with your same User UID and the Admin password set by your Host.',
  cameraTitle: 'Standalone Camera Studio',
  cameraSubtitle: 'Pro photo & video creation with real-time LUT color grading, beauty smoothing, manual optics, and teleprompter.',
  capturePhoto: 'Capture Photo',
  startRecording: 'Record Video',
  stopRecording: 'Stop Recording',
  burstShot: '5x Burst',
  teleprompter: 'Teleprompter',
  gallery: 'Captures',
  gamesTitle: 'Live Multiplayer Games',
  gamesSubtitle: 'Play 3D First-Person Shooter, Ludo & Snakes inside livestreams. Followers and viewers request a seat; the Host approves and plays live.',
  requestJoin: 'Request to Join',
  requestPending: 'Waiting for Host Approval',
  approvedSeat: 'Seated Player',
  hostApprovalQueue: 'Join Request Queue',
  approve: 'Approve',
  decline: 'Decline',
  rollDice: 'Roll Dice',
  addBot: 'Add Studio Bot',
  restartMatch: 'Restart Match',
  spectatingNote: 'Spectating live — request to join for Host approval.',
  workspaceTitle: 'Role Workspace',
  promoteAdmin: 'Promote User to Admin',
  assignTask: 'Assign Admin Task',
  assignedTasks: 'Host-Assigned Tasks',
  comparePlatforms: 'Platform Comparison',
  themeMode: 'Appearance',
  darkMode: 'Dark',
  lightMode: 'Light',
  colorGrade: 'Color Grading',
  languageLabel: 'Language',
  fontFamily: 'Typography',
  fontSize: 'Text Size',
  deviceSafeArea: 'OS & Cutout Safe Area',
  installApp: 'Install App',
};

const HI: TranslationKeys = {
  ...EN,
  navLive: 'लाइव',
  navGames: 'गेम्स',
  navCamera: 'कैमरा',
  navWorkspace: 'वर्कस्पेस',
  signIn: 'साइन इन',
  signOut: 'साइन आउट',
  preferences: 'डिस्प्ले और OS',
  searchPlaceholder: 'लाइव स्ट्रीम, होस्ट, बैंड या गेम रूम खोजें...',
  homeHeading: 'हर जगह लाइव',
  homeSubheading: 'सोलो, मल्टी-गेस्ट, ऑडियो, पीके बैटल, म्यूज़िक बैंड और लाइव गेम्स का साफ अनुभव।',
  catAll: 'सभी लाइव',
  catSolo: 'सोलो वीडियो',
  catMultiGuest: 'मल्टी-गेस्ट',
  catAudio: 'ऑडियो रूम',
  catPK: 'पीके बैटल',
  catGames: 'लाइव गेम्स',
  catMusicBand: 'म्यूज़िक और बैंड',
  catGaming: 'गेमिंग',
  catBrandDrop: 'ब्रांड ड्रॉप्स',
  viewers: 'दर्शक',
  seats: 'सीटें',
  loginTitle: 'यूनिफाइड STLive लॉगिन',
  loginSubtitle: 'गेस्ट, होस्ट, होस्ट-नियुक्त एडमिन, एजेंसी और बैंड के लिए एक लॉगिन।',
  createAccount: 'नया खाता बनाएं',
  roleGuest: 'गेस्ट',
  roleHost: 'होस्ट',
  roleAdmin: 'एडमिन',
  roleAgency: 'एजेंसी',
  roleBand: 'बैंड / ब्रांड',
  continueAsGuest: 'तुरंत गेस्ट प्रवेश',
  hostAdminPasswordLabel: 'होस्ट द्वारा दिया गया एडमिन पासवर्ड',
  cameraTitle: 'स्टैंडअलोन कैमरा स्टूडियो',
  capturePhoto: 'फ़ोटो लें',
  startRecording: 'वीडियो रिकॉर्ड करें',
  stopRecording: 'रिकॉर्डिंग रोकें',
  gamesTitle: 'लाइव मल्टीप्लेयर गेम्स',
  requestJoin: 'शामिल होने का अनुरोध',
  approve: 'स्वीकृत करें',
  decline: 'अस्वीकार',
  rollDice: 'पासा फेंकें',
  themeMode: 'थीम मोड',
  darkMode: 'डार्क',
  lightMode: 'लाइट',
  colorGrade: 'कलर ग्रेडिंग',
  languageLabel: 'भाषा',
  fontFamily: 'फ़ॉन्ट स्टाइल',
  fontSize: 'फ़ॉन्ट आकार',
  deviceSafeArea: 'OS और पंच-होल सेफ एरिया',
  installApp: 'ऐप इंस्टॉल करें',
};

const BN: TranslationKeys = {
  ...EN,
  navLive: 'লাইভ',
  navGames: 'গেমস',
  navCamera: 'ক্যামেরা',
  navWorkspace: 'ওয়ার্কস্পেস',
  signIn: 'সাইন ইন',
  signOut: 'সাইন আউট',
  preferences: 'ডিসপ্লে ও OS',
  searchPlaceholder: 'লাইভ স্ট্রিম, হোস্ট, ব্যান্ড বা গেম রুম খুঁজুন...',
  homeHeading: 'সবখানে লাইভ',
  homeSubheading: 'সোলো, মাল্টি-গেস্ট, অডিও, পিকে ব্যাটল, ব্যান্ড ও লাইভ গেমসের পরিচ্ছন্ন অভিজ্ঞতা।',
  catAll: 'সব লাইভ',
  catSolo: 'সোলো ভিডিও',
  catMultiGuest: 'মাল্টি-গেস্ট',
  catAudio: 'অডিও রুম',
  catPK: 'পিকে ব্যাটল',
  catGames: 'লাইভ গেমস',
  catMusicBand: 'মিউজিক ও ব্যান্ড',
  catGaming: 'গেমিং',
  catBrandDrop: 'ব্র্যান্ড ড্রপস',
  viewers: 'দর্শক',
  loginTitle: 'ইউনিফায়েড STLive লগইন',
  roleGuest: 'গেস্ট',
  roleHost: 'হোস্ট',
  roleAdmin: 'অ্যাডমিন',
  roleAgency: 'এজেন্সি',
  roleBand: 'ব্যান্ড / ব্র্যান্ড',
  continueAsGuest: 'দ্রুত গেস্ট প্রবেশ',
  cameraTitle: 'স্ট্যান্ডঅ্যালোন ক্যামেরা স্টুডিও',
  gamesTitle: 'লাইভ মাল্টিপ্লেয়ার গেমস',
  requestJoin: 'যোগদানের অনুরোধ',
  approve: 'অনুমোদন',
  decline: 'প্রত্যাখ্যান',
  rollDice: 'ছক্কা চালুন',
  themeMode: 'থিম',
  darkMode: 'ডার্ক',
  lightMode: 'লাইট',
  languageLabel: 'ভাষা',
  fontFamily: 'ফন্ট',
  fontSize: 'ফন্টের আকার',
  installApp: 'অ্যাপ ইনস্টল',
};

const ES: TranslationKeys = {
  ...EN,
  navLive: 'En Vivo',
  navGames: 'Juegos',
  navCamera: 'Cámara',
  navWorkspace: 'Panel',
  signIn: 'Iniciar sesión',
  signOut: 'Cerrar sesión',
  preferences: 'Pantalla y SO',
  searchPlaceholder: 'Buscar transmisiones, anfitriones, bandas o juegos...',
  homeHeading: 'En vivo en todo lugar',
  homeSubheading: 'Transmisiones limpias y minimalistas: solo, multi-invitado, audio, batallas PK, bandas y juegos.',
  catAll: 'Todo en vivo',
  catSolo: 'Video Solo',
  catMultiGuest: 'Multi-Invitado',
  catAudio: 'Salas de Audio',
  catPK: 'Batallas PK',
  catGames: 'Juegos en Vivo',
  catMusicBand: 'Música y Bandas',
  catGaming: 'Gaming',
  catBrandDrop: 'Lanzamientos',
  viewers: 'viendo',
  loginTitle: 'Acceso Unificado STLive',
  createAccount: 'Crear cuenta',
  roleGuest: 'Invitado',
  roleHost: 'Anfitrión',
  roleAdmin: 'Admin',
  roleAgency: 'Agencia',
  roleBand: 'Bandas / Marcas',
  continueAsGuest: 'Entrar como invitado',
  cameraTitle: 'Estudio de Cámara Independiente',
  capturePhoto: 'Tomar Foto',
  startRecording: 'Grabar Video',
  stopRecording: 'Detener',
  gamesTitle: 'Juegos Multijugador en Vivo',
  requestJoin: 'Solicitar unirse',
  approve: 'Aprobar',
  decline: 'Rechazar',
  rollDice: 'Lanzar Dado',
  themeMode: 'Apariencia',
  darkMode: 'Oscuro',
  lightMode: 'Claro',
  colorGrade: 'Gradación de Color',
  languageLabel: 'Idioma',
  fontFamily: 'Tipografía',
  fontSize: 'Tamaño de Texto',
  installApp: 'Instalar App',
};

const AR: TranslationKeys = {
  ...EN,
  navLive: 'مباشر',
  navGames: 'الألعاب',
  navCamera: 'الكاميرا',
  navWorkspace: 'مساحة العمل',
  signIn: 'تسجيل الدخول',
  signOut: 'تسجيل الخروج',
  preferences: 'العرض والنظام',
  searchPlaceholder: 'ابحث عن البث المباشر أو المضيفين أو الفرق أو الألعاب...',
  homeHeading: 'بث مباشر في كل مكان',
  homeSubheading: 'تجربة بث نظيفة وبسيطة عبر الفيديو الفردي والمتعدد والصوتي وتحديات PK والألعاب.',
  catAll: 'الكل مباشر',
  catSolo: 'فيديو فردي',
  catMultiGuest: 'متعدد الضيوف',
  catAudio: 'غرف صوتية',
  catPK: 'تحديات PK',
  catGames: 'ألعاب مباشرة',
  catMusicBand: 'فرق وموسيقى',
  catGaming: 'ألعاب فيديو',
  catBrandDrop: 'إطلاقات العلامات',
  viewers: 'مشاهد',
  loginTitle: 'دخول STLive الموحّد',
  createAccount: 'إنشاء حساب',
  roleGuest: 'ضيف',
  roleHost: 'مضيف',
  roleAdmin: 'مشرف',
  roleAgency: 'وكالة',
  roleBand: 'فرق / علامات',
  continueAsGuest: 'دخول فوري كضيف',
  hostAdminPasswordLabel: 'كلمة مرور المشرف من المضيف',
  cameraTitle: 'استوديو الكاميرا المستقل',
  capturePhoto: 'التقاط صورة',
  startRecording: 'تسجيل فيديو',
  stopRecording: 'إيقاف التسجيل',
  gamesTitle: 'ألعاب جماعية مباشرة',
  requestJoin: 'طلب الانضمام',
  approve: 'موافقة',
  decline: 'رفض',
  rollDice: 'رمي النرد',
  themeMode: 'المظهر',
  darkMode: 'داكن',
  lightMode: 'فاتح',
  colorGrade: 'تدرج الألوان',
  languageLabel: 'اللغة',
  fontFamily: 'الخط',
  fontSize: 'حجم النص',
  installApp: 'تثبيت التطبيق',
};

const JA: TranslationKeys = {
  ...EN,
  navLive: 'ライブ',
  navGames: 'ゲーム',
  navCamera: 'カメラ',
  navWorkspace: 'ワークスペース',
  signIn: 'ログイン',
  signOut: 'ログアウト',
  preferences: '表示・OS設定',
  searchPlaceholder: 'ライブ配信、ホスト、バンド、ゲームを検索...',
  homeHeading: 'すべてのデバイスでライブ',
  homeSubheading: 'ソロ、マルチゲスト、音声ルーム、PKバトル、バンド、ライブゲームをクリーンなデザインで。',
  catAll: 'すべて',
  catSolo: 'ソロ配信',
  catMultiGuest: 'マルチゲスト',
  catAudio: '音声ルーム',
  catPK: 'PKバトル',
  catGames: 'ライブゲーム',
  catMusicBand: '音楽・バンド',
  catGaming: 'ゲーム配信',
  catBrandDrop: 'ブランドドロップ',
  viewers: '視聴中',
  loginTitle: 'STLive 統合ログイン',
  createAccount: 'アカウント作成',
  roleGuest: 'ゲスト',
  roleHost: 'ホスト',
  roleAdmin: '管理者',
  roleAgency: 'エージェンシー',
  roleBand: 'バンド・ブランド',
  continueAsGuest: 'ゲストとして開始',
  cameraTitle: 'スタンドアロン・カメラスタジオ',
  capturePhoto: '写真を撮影',
  startRecording: '録画開始',
  stopRecording: '録画停止',
  gamesTitle: 'ライブマルチプレイゲーム',
  requestJoin: '参加リクエスト',
  approve: '承認',
  decline: '辞退',
  rollDice: 'サイコロを振る',
  themeMode: 'テーマ',
  darkMode: 'ダーク',
  lightMode: 'ライト',
  colorGrade: 'カラーグレーディング',
  languageLabel: '言語',
  fontFamily: 'フォント',
  fontSize: '文字サイズ',
  installApp: 'アプリをインストール',
};

const DICTIONARIES: Record<LocaleCode, TranslationKeys> = {
  en: EN,
  hi: HI,
  bn: BN,
  es: ES,
  ar: AR,
  ja: JA,
};

export function getTranslator(locale: LocaleCode) {
  const dict = DICTIONARIES[locale] || EN;
  return (key: keyof TranslationKeys): string => dict[key] || EN[key];
}

export function isRTL(locale: LocaleCode): boolean {
  return locale === 'ar';
}

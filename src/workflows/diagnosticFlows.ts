/**
 * Structured Diagnostic Workflows
 * Decision trees for common EV charging issues with step-by-step troubleshooting
 */

export interface WorkflowStep {
  id: string;
  type: 'question' | 'action' | 'check' | 'resolution' | 'escalation';
  content: {
    he: string; // Hebrew
    en: string; // English
    ru: string; // Russian
    ar: string; // Arabic
  };
  // For questions: what to ask the user
  // For actions: what the agent should do (call tool, check status, etc.)
  // For checks: conditional logic based on data
  // For resolution: successful outcome
  // For escalation: when to hand off to human
  nextSteps?: {
    condition?: string; // e.g., "answer === 'yes'", "status === 'offline'"
    nextStepId: string;
  }[];
  toolCall?: {
    toolName: string;
    params: Record<string, any>;
  };
  escalationTrigger?: {
    reason: string;
    urgency: 'low' | 'medium' | 'high' | 'critical';
  };
  analytics?: {
    successRate?: number; // Track how often this step leads to resolution
    avgTimeToComplete?: number; // In seconds
  };
}

export interface DiagnosticWorkflow {
  id: string;
  name: {
    he: string;
    en: string;
    ru: string;
    ar: string;
  };
  description: {
    he: string;
    en: string;
    ru: string;
    ar: string;
  };
  triggers: string[]; // Keywords/patterns that trigger this workflow
  estimatedTime: number; // In minutes
  successRate: number; // Historical success rate (0-1)
  steps: WorkflowStep[];
  category: 'charging' | 'payment' | 'technical' | 'app' | 'account';
  priority: 'high' | 'medium' | 'low';
}

/**
 * Workflow 1: Charging Won't Start
 * Most common issue - covers ~40% of support tickets
 */
export const chargingWontStartWorkflow: DiagnosticWorkflow = {
  id: 'charging-wont-start',
  name: {
    he: 'הטעינה לא מתחילה',
    en: 'Charging Won\'t Start',
    ru: 'Зарядка не начинается',
    ar: 'الشحن لا يبدأ',
  },
  description: {
    he: 'תהליך מובנה לאבחון בעיות התחלת טעינה',
    en: 'Structured process to diagnose charging start issues',
    ru: 'Структурированный процесс диагностики проблем запуска зарядки',
    ar: 'عملية منظمة لتشخيص مشاكل بدء الشحن',
  },
  triggers: [
    'charging won\'t start',
    'can\'t start charging',
    'nothing happens',
    'not charging',
    'לא מתחיל',
    'הטעינה לא עובדת',
    'לא קורה כלום',
  ],
  estimatedTime: 5,
  successRate: 0.85,
  category: 'charging',
  priority: 'high',
  steps: [
    {
      id: 'step1-empathy',
      type: 'question',
      content: {
        he: 'אני מבין שזה מתסכל שהטעינה לא מתחילה. בוא ננסה לפתור את זה ביחד. איך קוראים לך?',
        en: 'I understand it\'s frustrating when charging won\'t start. Let\'s solve this together. What\'s your name?',
        ru: 'Я понимаю, что это расстраивает, когда зарядка не начинается. Давайте решим это вместе. Как вас зовут?',
        ar: 'أفهم أنه من المحبط عندما لا يبدأ الشحن. دعونا نحل هذا معًا. ما اسمك؟',
      },
      nextSteps: [
        { nextStepId: 'step2-station-check' },
      ],
    },
    {
      id: 'step2-station-check',
      type: 'action',
      content: {
        he: 'אוקי {name}, תודה. מה מספר העמדה שאתה עומד ליד?',
        en: 'Okay {name}, thank you. What\'s the station number you\'re at?',
        ru: 'Хорошо {name}, спасибо. Какой номер станции?',
        ar: 'حسنًا {name}، شكرًا. ما هو رقم المحطة؟',
      },
      nextSteps: [
        { nextStepId: 'step3-check-station-status' },
      ],
    },
    {
      id: 'step3-check-station-status',
      type: 'check',
      content: {
        he: 'רגע אחד, אני בודק את מצב העמדה...',
        en: 'One moment, checking the station status...',
        ru: 'Минутку, проверяю статус станции...',
        ar: 'لحظة، أتحقق من حالة المحطة...',
      },
      toolCall: {
        toolName: 'ampecoStationStatus',
        params: { stationId: '{userInput}' },
      },
      nextSteps: [
        { condition: 'status === "offline"', nextStepId: 'step4a-station-offline' },
        { condition: 'status === "available"', nextStepId: 'step4b-station-available' },
        { condition: 'status === "occupied"', nextStepId: 'step4c-station-occupied' },
        { condition: 'status === "error"', nextStepId: 'step4d-station-error' },
      ],
    },
    {
      id: 'step4a-station-offline',
      type: 'resolution',
      content: {
        he: 'אני רואה שהעמדה הזו לא מחוברת למערכת כרגע. יש עמדה אחרת קרובה שאתה יכול להשתמש בה? אם לא, אני יכול להעביר אותך לנציג שיבדוק מה קורה.',
        en: 'I see this station is offline right now. Is there another nearby station you can use? If not, I can connect you to a human agent who will investigate.',
        ru: 'Я вижу, что эта станция сейчас не в сети. Есть ли другая станция поблизости? Если нет, я могу соединить вас с оператором.',
        ar: 'أرى أن هذه المحطة غير متصلة الآن. هل هناك محطة أخرى قريبة؟ إذا لم يكن كذلك، يمكنني توصيلك بوكيل بشري.',
      },
      escalationTrigger: {
        reason: 'Station offline - requires physical inspection',
        urgency: 'high',
      },
    },
    {
      id: 'step4b-station-available',
      type: 'question',
      content: {
        he: 'העמדה פעילה ותקינה. האם חיברת את הכבל לרכב ולחצת על כפתור ההתחלה?',
        en: 'The station is active and working. Have you connected the cable to your vehicle and pressed the start button?',
        ru: 'Станция активна и работает. Вы подключили кабель к автомобилю и нажали кнопку старт?',
        ar: 'المحطة نشطة وتعمل. هل قمت بتوصيل الكابل بالسيارة وضغطت على زر البدء؟',
      },
      nextSteps: [
        { condition: 'answer === "yes"', nextStepId: 'step5a-cable-connected' },
        { condition: 'answer === "no"', nextStepId: 'step5b-instructions' },
      ],
    },
    {
      id: 'step4c-station-occupied',
      type: 'check',
      content: {
        he: 'אני רואה שהעמדה כבר בשימוש. האם זו הפעלה שלך?',
        en: 'I see the station is already in use. Is this your charging session?',
        ru: 'Я вижу, что станция уже используется. Это ваша сессия зарядки?',
        ar: 'أرى أن المحطة قيد الاستخدام بالفعل. هل هذه جلسة الشحن الخاصة بك؟',
      },
      toolCall: {
        toolName: 'ampecoActiveSession',
        params: { stationId: '{userInput}' },
      },
      nextSteps: [
        { condition: 'session.userId === userId', nextStepId: 'step6-already-charging' },
        { condition: 'session.userId !== userId', nextStepId: 'step7-occupied-by-other' },
      ],
    },
    {
      id: 'step4d-station-error',
      type: 'action',
      content: {
        he: 'אני רואה שיש שגיאה בעמדה. תן לי רגע לנסות לאפס אותה...',
        en: 'I see there\'s an error on the station. Let me try to reset it...',
        ru: 'Я вижу ошибку на станции. Позвольте мне попытаться сбросить ее...',
        ar: 'أرى أن هناك خطأ في المحطة. دعني أحاول إعادة تعيينها...',
      },
      toolCall: {
        toolName: 'ampecoResetStation',
        params: { stationId: '{userInput}' },
      },
      nextSteps: [
        { condition: 'resetSuccess === true', nextStepId: 'step8-reset-success' },
        { condition: 'resetSuccess === false', nextStepId: 'step9-reset-failed' },
      ],
    },
    {
      id: 'step5a-cable-connected',
      type: 'question',
      content: {
        he: 'האם הנורית על הכבל דולקת? איזה צבע?',
        en: 'Is the light on the cable on? What color is it?',
        ru: 'Горит ли индикатор на кабеле? Какого цвета?',
        ar: 'هل الضوء على الكابل مضاء؟ ما لونه؟',
      },
      nextSteps: [
        { condition: 'answer.includes("green")', nextStepId: 'step10-green-light' },
        { condition: 'answer.includes("red")', nextStepId: 'step11-red-light' },
        { condition: 'answer.includes("no") || answer.includes("off")', nextStepId: 'step12-no-light' },
      ],
    },
    {
      id: 'step5b-instructions',
      type: 'resolution',
      content: {
        he: 'אין בעיה! הנה הסדר הנכון:\n1. קודם חבר את הכבל לרכב\n2. שים לב שהוא נכנס עד הסוף (תשמע "קליק")\n3. לחץ על כפתור ההתחלה בעמדה\n4. או פתח את האפליקציה ותלחץ "התחל טעינה"\n\nנסה את זה ותגיד לי אם זה עובד?',
        en: 'No problem! Here\'s the correct order:\n1. First connect the cable to your vehicle\n2. Make sure it clicks in fully\n3. Press the start button on the station\n4. Or open the app and tap "Start Charging"\n\nTry that and let me know if it works?',
        ru: 'Нет проблем! Вот правильный порядок:\n1. Сначала подключите кабель к автомобилю\n2. Убедитесь, что он защелкнулся\n3. Нажмите кнопку старт на станции\n4. Или откройте приложение и нажмите "Начать зарядку"\n\nПопробуйте это и дайте мне знать, работает ли?',
        ar: 'لا مشكلة! هذا هو الترتيب الصحيح:\n1. أولاً قم بتوصيل الكابل بالسيارة\n2. تأكد من أنه ينقر بالكامل\n3. اضغط على زر البدء في المحطة\n4. أو افتح التطبيق واضغط على "بدء الشحن"\n\nجرب ذلك وأخبرني إذا نجح؟',
      },
    },
    {
      id: 'step6-already-charging',
      type: 'resolution',
      content: {
        he: 'אני רואה שהטעינה שלך כבר פעילה! היא התחילה לפני {sessionStartTime}. הכל עובד כמו שצריך 👍',
        en: 'I see your charging is already active! It started {sessionStartTime} ago. Everything is working as it should 👍',
        ru: 'Я вижу, что ваша зарядка уже активна! Она началась {sessionStartTime} назад. Все работает как надо 👍',
        ar: 'أرى أن الشحن الخاص بك نشط بالفعل! بدأ منذ {sessionStartTime}. كل شيء يعمل كما ينبغي 👍',
      },
    },
    {
      id: 'step7-occupied-by-other',
      type: 'resolution',
      content: {
        he: 'העמדה הזו כבר בשימוש של מישהו אחר כרגע. יש עמדה אחרת פנויה בסביבה שאתה יכול להשתמש בה?',
        en: 'This station is currently being used by someone else. Is there another available station nearby you could use?',
        ru: 'Эта станция сейчас используется кем-то другим. Есть ли другая доступная станция поблизости?',
        ar: 'هذه المحطة قيد الاستخدام من قبل شخص آخر حاليًا. هل هناك محطة أخرى متاحة قريبة يمكنك استخدامها؟',
      },
    },
    {
      id: 'step8-reset-success',
      type: 'resolution',
      content: {
        he: 'מצוין! איפסתי את העמדה. תנסה עכשיו לחבר את הכבל ולהתחיל טעינה. זה אמור לעבוד עכשיו.',
        en: 'Great! I\'ve reset the station. Try connecting the cable and starting charging now. It should work now.',
        ru: 'Отлично! Я сбросил станцию. Попробуйте подключить кабель и начать зарядку сейчас. Теперь должно работать.',
        ar: 'رائع! لقد قمت بإعادة تعيين المحطة. حاول توصيل الكابل وبدء الشحن الآن. يجب أن يعمل الآن.',
      },
    },
    {
      id: 'step9-reset-failed',
      type: 'escalation',
      content: {
        he: 'מצטער, לא הצלחתי לאפס את העמדה מרחוק. אני מעביר אותך לנציג אנושי שיטפל בזה מיד.',
        en: 'Sorry, I couldn\'t reset the station remotely. I\'m connecting you to a human agent who will handle this right away.',
        ru: 'Извините, я не смог сбросить станцию удаленно. Я соединяю вас с оператором, который займется этим немедленно.',
        ar: 'آسف، لم أتمكن من إعادة تعيين المحطة عن بُعد. أقوم بتوصيلك بوكيل بشري سيتعامل مع هذا على الفور.',
      },
      escalationTrigger: {
        reason: 'Remote reset failed - requires technical intervention',
        urgency: 'high',
      },
    },
    {
      id: 'step10-green-light',
      type: 'question',
      content: {
        he: 'נורית ירוקה זה סימן טוב! האם פתחת את האפליקציה ולחצת "התחל טעינה"?',
        en: 'Green light is a good sign! Have you opened the app and tapped "Start Charging"?',
        ru: 'Зеленый свет - это хороший знак! Вы открыли приложение и нажали "Начать зарядку"?',
        ar: 'الضوء الأخضر علامة جيدة! هل فتحت التطبيق وضغطت على "بدء الشحن"؟',
      },
      nextSteps: [
        { condition: 'answer === "yes"', nextStepId: 'step13-app-started' },
        { condition: 'answer === "no"', nextStepId: 'step14-use-app' },
      ],
    },
    {
      id: 'step11-red-light',
      type: 'action',
      content: {
        he: 'נורית אדומה מציינת בעיה בתקשורת. תנסה להוציא את הכבל ולהכניס אותו שוב, עד שתשמע קליק.',
        en: 'Red light indicates a communication issue. Try unplugging the cable and reconnecting it firmly until you hear a click.',
        ru: 'Красный свет указывает на проблему связи. Попробуйте отсоединить кабель и снова подключить его до щелчка.',
        ar: 'الضوء الأحمر يشير إلى مشكلة في الاتصال. حاول فصل الكابل وإعادة توصيله بإحكام حتى تسمع نقرة.',
      },
      nextSteps: [
        { nextStepId: 'step15-retry-connection' },
      ],
    },
    {
      id: 'step12-no-light',
      type: 'check',
      content: {
        he: 'אם אין נורה בכלל, יכול להיות שיש בעיה בכבל או בעמדה. תנסה מחבר אחר בעמדה (אם יש)?',
        en: 'If there\'s no light at all, there might be an issue with the cable or station. Can you try another connector on the station (if available)?',
        ru: 'Если индикатора нет вообще, возможно проблема с кабелем или станцией. Можете попробовать другой разъем (если есть)?',
        ar: 'إذا لم يكن هناك ضوء على الإطلاق، فقد تكون هناك مشكلة في الكابل أو المحطة. هل يمكنك تجربة موصل آخر (إذا كان متاحًا)؟',
      },
      nextSteps: [
        { condition: 'answer === "worked"', nextStepId: 'step16-other-connector-works' },
        { condition: 'answer === "failed"', nextStepId: 'step17-escalate-hardware' },
      ],
    },
    {
      id: 'step13-app-started',
      type: 'check',
      content: {
        he: 'תן לי רגע לבדוק אם הטעינה התחילה במערכת...',
        en: 'Let me check if charging started in the system...',
        ru: 'Позвольте проверить, началась ли зарядка в системе...',
        ar: 'دعني أتحقق من بدء الشحن في النظام...',
      },
      toolCall: {
        toolName: 'ampecoActiveSession',
        params: { userId: '{userId}' },
      },
      nextSteps: [
        { condition: 'session.status === "active"', nextStepId: 'step18-charging-active' },
        { condition: 'session.status !== "active"', nextStepId: 'step19-not-active' },
      ],
    },
    {
      id: 'step14-use-app',
      type: 'resolution',
      content: {
        he: 'אוקיי, פתח את האפליקציה עכשיו, תבחר את העמדה ותלחץ על "התחל טעינה". זה אמור להפעיל את הטעינה מיד.',
        en: 'Okay, open the app now, select the station and tap "Start Charging". This should start charging immediately.',
        ru: 'Хорошо, откройте приложение сейчас, выберите станцию и нажмите "Начать зарядку". Это должно начать зарядку немедленно.',
        ar: 'حسنًا، افتح التطبيق الآن، اختر المحطة واضغط على "بدء الشحن". يجب أن يبدأ الشحن على الفور.',
      },
    },
    {
      id: 'step15-retry-connection',
      type: 'question',
      content: {
        he: 'עבד? איזה צבע הנורית עכשיו?',
        en: 'Did it work? What color is the light now?',
        ru: 'Это сработало? Какого цвета индикатор сейчас?',
        ar: 'هل نجح؟ ما لون الضوء الآن؟',
      },
      nextSteps: [
        { condition: 'answer.includes("green")', nextStepId: 'step10-green-light' },
        { condition: 'answer.includes("red") || answer.includes("no")', nextStepId: 'step17-escalate-hardware' },
      ],
    },
    {
      id: 'step16-other-connector-works',
      type: 'resolution',
      content: {
        he: 'מצוין! נראה שהמחבר הקודם היה תקול. תודה שדיווחת על זה, נשלח טכנאי לתקן אותו. תוכל להמשיך לטעון מהמחבר השני.',
        en: 'Great! Looks like the previous connector was faulty. Thanks for reporting, we\'ll send a technician to fix it. You can continue charging from the other connector.',
        ru: 'Отлично! Похоже, предыдущий разъем был неисправен. Спасибо за сообщение, мы отправим техника для ремонта. Вы можете продолжать зарядку с другого разъема.',
        ar: 'رائع! يبدو أن الموصل السابق كان معيبًا. شكرًا على الإبلاغ، سنرسل فنيًا لإصلاحه. يمكنك الاستمرار في الشحن من الموصل الآخر.',
      },
    },
    {
      id: 'step17-escalate-hardware',
      type: 'escalation',
      content: {
        he: 'נראה שיש בעיה חומרה בעמדה הזו. אני מעביר אותך לנציג אנושי שידאג שטכנאי יגיע לתקן את זה בהקדם. בינתיים, יש עמדה אחרת בסביבה?',
        en: 'Looks like there\'s a hardware issue with this station. I\'m connecting you to a human agent who will arrange for a technician ASAP. Meanwhile, is there another station nearby?',
        ru: 'Похоже, есть проблема с оборудованием этой станции. Я соединяю вас с оператором, который организует выезд техника как можно скорее. А пока, есть ли другая станция поблизости?',
        ar: 'يبدو أن هناك مشكلة في الأجهزة بهذه المحطة. أقوم بتوصيلك بوكيل بشري سينظم قدوم فني في أقرب وقت ممكن. في هذه الأثناء، هل هناك محطة أخرى قريبة؟',
      },
      escalationTrigger: {
        reason: 'Hardware failure - requires physical repair',
        urgency: 'high',
      },
    },
    {
      id: 'step18-charging-active',
      type: 'resolution',
      content: {
        he: 'מעולה! אני רואה שהטעינה שלך פעילה וכבר טוענת {chargingPower} קילוואט. הכל עובד מצוין! 🎉',
        en: 'Excellent! I see your charging is active and already charging at {chargingPower} kW. Everything is working great! 🎉',
        ru: 'Отлично! Я вижу, что ваша зарядка активна и уже заряжается на {chargingPower} кВт. Все работает отлично! 🎉',
        ar: 'ممتاز! أرى أن الشحن الخاص بك نشط ويشحن بالفعل بـ {chargingPower} كيلوواط. كل شيء يعمل بشكل رائع! 🎉',
      },
    },
    {
      id: 'step19-not-active',
      type: 'escalation',
      content: {
        he: 'מוזר, לחצת על התחל אבל הטעינה לא מתחילה. תן לי להעביר אותך לנציג אנושי שיבדוק מה הבעיה.',
        en: 'Strange, you pressed start but charging isn\'t beginning. Let me connect you to a human agent to investigate the issue.',
        ru: 'Странно, вы нажали старт, но зарядка не начинается. Позвольте соединить вас с оператором для расследования проблемы.',
        ar: 'غريب، ضغطت على البدء لكن الشحن لا يبدأ. دعني أوصلك بوكيل بشري للتحقيق في المشكلة.',
      },
      escalationTrigger: {
        reason: 'Session start failure - unclear cause',
        urgency: 'medium',
      },
    },
  ],
};

/**
 * Workflow 2: Slow Charging Speed
 * Second most common - covers ~25% of tickets
 */
export const slowChargingWorkflow: DiagnosticWorkflow = {
  id: 'slow-charging',
  name: {
    he: 'טעינה איטית',
    en: 'Slow Charging Speed',
    ru: 'Медленная зарядка',
    ar: 'سرعة شحن بطيئة',
  },
  description: {
    he: 'אבחון בעיות מהירות טעינה',
    en: 'Diagnose charging speed issues',
    ru: 'Диагностика проблем скорости зарядки',
    ar: 'تشخيص مشاكل سرعة الشحن',
  },
  triggers: [
    'slow charging',
    'charging slowly',
    'takes too long',
    'very slow',
    'טעינה איטית',
    'טוען לאט',
    'לוקח הרבה זמן',
  ],
  estimatedTime: 4,
  successRate: 0.78,
  category: 'charging',
  priority: 'medium',
  steps: [
    {
      id: 'slow-step1',
      type: 'question',
      content: {
        he: 'אני מבין שהטעינה איטית מהצפוי. באיזו מהירות אתה טוען עכשיו? (בקילוואט)',
        en: 'I understand charging is slower than expected. What speed are you charging at now? (in kW)',
        ru: 'Я понимаю, что зарядка медленнее ожидаемого. С какой скоростью вы заряжаетесь сейчас? (в кВт)',
        ar: 'أفهم أن الشحن أبطأ من المتوقع. ما السرعة التي تشحن بها الآن؟ (بالكيلوواط)',
      },
      nextSteps: [
        { nextStepId: 'slow-step2' },
      ],
    },
    {
      id: 'slow-step2',
      type: 'check',
      content: {
        he: 'תן לי לבדוק את מצב העמדה והרכב שלך...',
        en: 'Let me check the station status and your vehicle...',
        ru: 'Позвольте проверить статус станции и вашего автомобиля...',
        ar: 'دعني أتحقق من حالة المحطة وسيارتك...',
      },
      toolCall: {
        toolName: 'ampecoActiveSession',
        params: { userId: '{userId}' },
      },
      nextSteps: [
        { condition: 'power < 10', nextStepId: 'slow-step3-very-slow' },
        { condition: 'power >= 10 && power < 20', nextStepId: 'slow-step4-moderate' },
        { condition: 'power >= 20', nextStepId: 'slow-step5-normal' },
      ],
    },
    {
      id: 'slow-step3-very-slow',
      type: 'question',
      content: {
        he: 'אני רואה {power} קילוואט - זה אכן איטי. איזה רכב יש לך?',
        en: 'I see {power} kW - that is indeed slow. What vehicle do you have?',
        ru: 'Я вижу {power} кВт - это действительно медленно. Какой у вас автомобиль?',
        ar: 'أرى {power} كيلوواط - هذا بطيء حقًا. ما نوع سيارتك؟',
      },
      nextSteps: [
        { nextStepId: 'slow-step6-vehicle-limit' },
      ],
    },
    {
      id: 'slow-step4-moderate',
      type: 'resolution',
      content: {
        he: '{power} קילוואט זה בעצם מהירות סבירה לטעינה AC רגילה. האם ציפית למהירות גבוהה יותר? (טעינה DC מהירה נמצאת בעמדות ייעודיות)',
        en: '{power} kW is actually reasonable speed for regular AC charging. Were you expecting faster? (Fast DC charging is at dedicated stations)',
        ru: '{power} кВт - это разумная скорость для обычной AC зарядки. Вы ожидали быстрее? (Быстрая DC зарядка на специальных станциях)',
        ar: '{power} كيلوواط هي سرعة معقولة للشحن العادي AC. هل كنت تتوقع أسرع؟ (الشحن السريع DC في محطات مخصصة)',
      },
    },
    {
      id: 'slow-step5-normal',
      type: 'resolution',
      content: {
        he: '{power} קילוואט זו מהירות טעינה תקינה! האם ציפית למשהו אחר?',
        en: '{power} kW is normal charging speed! Were you expecting something different?',
        ru: '{power} кВт - это нормальная скорость зарядки! Вы ожидали что-то другое?',
        ar: '{power} كيلوواط سرعة شحن عادية! هل كنت تتوقع شيئًا مختلفًا؟',
      },
    },
    {
      id: 'slow-step6-vehicle-limit',
      type: 'action',
      content: {
        he: 'אני בודק מה המהירות המקסימלית של {vehicle}...',
        en: 'Checking the max speed for {vehicle}...',
        ru: 'Проверяю максимальную скорость для {vehicle}...',
        ar: 'أتحقق من السرعة القصوى لـ {vehicle}...',
      },
      toolCall: {
        toolName: 'semanticSearch',
        params: { query: 'max charging speed {vehicle}' },
      },
      nextSteps: [
        { nextStepId: 'slow-step7-explain-limit' },
      ],
    },
    {
      id: 'slow-step7-explain-limit',
      type: 'resolution',
      content: {
        he: 'ה-{vehicle} שלך תומך במהירות מקסימלית של {maxSpeed} קילוואט. זה אומר שהמהירות שאתה רואה היא בעצם המקסימום שהרכב יכול לקבל. זה לא בעיה בעמדה!',
        en: 'Your {vehicle} supports a maximum of {maxSpeed} kW. This means the speed you\'re seeing is actually the max your vehicle can accept. It\'s not an issue with the station!',
        ru: 'Ваш {vehicle} поддерживает максимум {maxSpeed} кВт. Это означает, что скорость, которую вы видите, это максимум, который может принять ваш автомобиль. Это не проблема со станцией!',
        ar: 'سيارتك {vehicle} تدعم حدًا أقصى {maxSpeed} كيلوواط. هذا يعني أن السرعة التي تراها هي في الواقع الحد الأقصى الذي يمكن لسيارتك قبوله. ليست مشكلة في المحطة!',
      },
    },
  ],
};

/**
 * Workflow 3: Payment Issue
 * ~15% of tickets
 */
export const paymentIssueWorkflow: DiagnosticWorkflow = {
  id: 'payment-issue',
  name: {
    he: 'בעיית תשלום',
    en: 'Payment Issue',
    ru: 'Проблема с оплатой',
    ar: 'مشكلة في الدفع',
  },
  description: {
    he: 'פתרון בעיות תשלום וחיוב',
    en: 'Resolve payment and billing issues',
    ru: 'Решение проблем с оплатой и выставлением счетов',
    ar: 'حل مشاكل الدفع والفواتير',
  },
  triggers: [
    'payment',
    'card declined',
    'billing',
    'charged',
    'overcharged',
    'תשלום',
    'כרטיס נדחה',
    'חיוב',
    'חייבו אותי',
  ],
  estimatedTime: 3,
  successRate: 0.92,
  category: 'payment',
  priority: 'high',
  steps: [
    {
      id: 'pay-step1',
      type: 'question',
      content: {
        he: 'אני כאן לעזור עם בעיית התשלום. מה בדיוק קרה?',
        en: 'I\'m here to help with the payment issue. What exactly happened?',
        ru: 'Я здесь, чтобы помочь с проблемой оплаты. Что именно произошло?',
        ar: 'أنا هنا للمساعدة في مشكلة الدفع. ماذا حدث بالضبط؟',
      },
      nextSteps: [
        { condition: 'issue.includes("declined")', nextStepId: 'pay-step2-declined' },
        { condition: 'issue.includes("overcharged") || issue.includes("wrong amount")', nextStepId: 'pay-step3-overcharged' },
        { condition: 'issue.includes("refund")', nextStepId: 'pay-step4-refund' },
      ],
    },
    {
      id: 'pay-step2-declined',
      type: 'resolution',
      content: {
        he: 'אם הכרטיס נדחה, יכול להיות שאין מספיק יתרה או שהבנק חסם את העסקה. תנסה:\n1. לבדוק יתרה בחשבון\n2. להשתמש בכרטיס אחר\n3. ליצור קשר עם הבנק לאישור העסקה\n\nאפשר גם להשתמש בכרטיס RFID אם יש לך.',
        en: 'If the card was declined, it might be insufficient funds or the bank blocked the transaction. Try:\n1. Check your account balance\n2. Use a different card\n3. Contact your bank to approve the transaction\n\nYou can also use an RFID card if you have one.',
        ru: 'Если карта была отклонена, возможно недостаточно средств или банк заблокировал транзакцию. Попробуйте:\n1. Проверить баланс счета\n2. Использовать другую карту\n3. Связаться с банком для одобрения транзакции\n\nТакже можно использовать RFID карту, если есть.',
        ar: 'إذا تم رفض البطاقة، فقد يكون هناك رصيد غير كافٍ أو أن البنك حظر المعاملة. حاول:\n1. التحقق من رصيد حسابك\n2. استخدام بطاقة مختلفة\n3. الاتصال بالبنك للموافقة على المعاملة\n\nيمكنك أيضًا استخدام بطاقة RFID إذا كان لديك واحدة.',
      },
    },
    {
      id: 'pay-step3-overcharged',
      type: 'action',
      content: {
        he: 'אני בודק את ההיסטוריה שלך...',
        en: 'Checking your history...',
        ru: 'Проверяю вашу историю...',
        ar: 'أتحقق من سجلك...',
      },
      toolCall: {
        toolName: 'ampecoSessionHistory',
        params: { userId: '{userId}' },
      },
      nextSteps: [
        { nextStepId: 'pay-step5-explain-charge' },
      ],
    },
    {
      id: 'pay-step4-refund',
      type: 'escalation',
      content: {
        he: 'בקשות החזר כספי מטופלות על ידי צוות הכספים. אני מעביר אותך לנציג אנושי שיטפל בזה.',
        en: 'Refund requests are handled by the finance team. I\'m connecting you to a human agent who will process this.',
        ru: 'Запросы на возврат обрабатываются финансовым отделом. Я соединяю вас с оператором, который обработает это.',
        ar: 'يتم التعامل مع طلبات الاسترداد من قبل فريق المالية. أقوم بتوصيلك بوكيل بشري سيعالج هذا.',
      },
      escalationTrigger: {
        reason: 'Refund request - requires finance approval',
        urgency: 'medium',
      },
    },
    {
      id: 'pay-step5-explain-charge',
      type: 'resolution',
      content: {
        he: 'אני רואה שהטעינה הייתה {energy} קוט"ש במחיר {tariff} לקוט"ש, סה"כ {total}. החיוב נכון לפי כמות האנרגיה שקיבלת. זה ברור?',
        en: 'I see the charging was {energy} kWh at {tariff} per kWh, totaling {total}. The charge is correct based on the energy you received. Does that make sense?',
        ru: 'Я вижу, что зарядка была {energy} кВтч по цене {tariff} за кВтч, всего {total}. Оплата правильная на основе полученной энергии. Понятно?',
        ar: 'أرى أن الشحن كان {energy} كيلوواط ساعة بسعر {tariff} لكل كيلوواط ساعة، بإجمالي {total}. الرسوم صحيحة بناءً على الطاقة التي تلقيتها. هل هذا واضح؟',
      },
    },
  ],
};

// Export all workflows
export const DIAGNOSTIC_WORKFLOWS: DiagnosticWorkflow[] = [
  chargingWontStartWorkflow,
  slowChargingWorkflow,
  paymentIssueWorkflow,
];

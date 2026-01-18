// Fallback responses when services are unavailable
export const FALLBACK_RESPONSES = {
  he: `מצטער מאוד, אך המערכת שלי נתקלה בבעיה זמנית. 😔

אני לא יכול לגשת למערכות כרגע, אבל אני כאן לעזור בדרכים אחרות:

📞 **צור קשר עם התמיכה:**
- טלפון: 1-800-CHARGE
- אימייל: support@edgecontrol.com

💡 **טיפים מהירים בינתיים:**
- ודא שהכבל מחובר היטב לרכב ולעמדה
- נסה להוציא ולהכניס את הכבל שוב
- בדוק שהאפליקציה מעודכנת לגרסה האחרונה
- אם העמדה לא עובדת, נסה עמדה סמוכה אחרת

אשמח לעזור מיד כשהמערכת תחזור לפעולה!`,

  en: `I'm very sorry, but my system is experiencing a temporary issue. 😔

I can't access the systems right now, but I'm here to help in other ways:

📞 **Contact Support:**
- Phone: 1-800-CHARGE
- Email: support@edgecontrol.com

💡 **Quick tips in the meantime:**
- Make sure the cable is firmly connected to your car and the station
- Try unplugging and reconnecting the cable
- Check that your app is updated to the latest version
- If the station isn't working, try another nearby station

I'll be happy to help as soon as the system is back online!`,

  ru: `Мне очень жаль, но моя система столкнулась с временной проблемой. 😔

Я не могу получить доступ к системам сейчас, но я здесь, чтобы помочь другими способами:

📞 **Связаться с поддержкой:**
- Телефон: 1-800-CHARGE
- Email: support@edgecontrol.com

💡 **Быстрые советы:**
- Убедитесь, что кабель надежно подключен к автомобилю и станции
- Попробуйте отключить и снова подключить кабель
- Проверьте, что ваше приложение обновлено до последней версии
- Если станция не работает, попробуйте другую ближайшую станцию

Буду рад помочь, как только система вернется в онлайн!`,

  ar: `أنا آسف جداً، لكن نظامي يواجه مشكلة مؤقتة. 😔

لا يمكنني الوصول إلى الأنظمة الآن، لكنني هنا للمساعدة بطرق أخرى:

📞 **الاتصال بالدعم:**
- الهاتف: 1-800-CHARGE
- البريد الإلكتروني: support@edgecontrol.com

💡 **نصائح سريعة في هذه الأثناء:**
- تأكد من توصيل الكابل بإحكام بسيارتك والمحطة
- حاول فصل الكابل وإعادة توصيله
- تحقق من تحديث تطبيقك إلى أحدث إصدار
- إذا لم تعمل المحطة، جرب محطة قريبة أخرى

سأكون سعيداً بالمساعدة بمجرد عودة النظام للعمل!`
};

/**
 * Get fallback response in appropriate language
 */
export function getFallbackResponse(language: 'he' | 'en' | 'ru' | 'ar' = 'he'): string {
  return FALLBACK_RESPONSES[language] || FALLBACK_RESPONSES.he;
}

/**
 * Track service health
 */
class ServiceHealthTracker {
  private failures: Map<string, { count: number; lastFailure: number }> = new Map();
  private readonly maxFailures = 3;
  private readonly failureWindow = 5 * 60 * 1000; // 5 minutes

  recordFailure(service: string): void {
    const now = Date.now();
    const current = this.failures.get(service) || { count: 0, lastFailure: 0 };

    // Reset count if outside failure window
    if (now - current.lastFailure > this.failureWindow) {
      current.count = 0;
    }

    current.count++;
    current.lastFailure = now;
    this.failures.set(service, current);
  }

  recordSuccess(service: string): void {
    this.failures.delete(service);
  }

  isHealthy(service: string): boolean {
    const current = this.failures.get(service);
    if (!current) return true;

    const now = Date.now();
    
    // Service is unhealthy if too many recent failures
    if (current.count >= this.maxFailures && (now - current.lastFailure) < this.failureWindow) {
      return false;
    }

    return true;
  }

  getStatus(service: string): { healthy: boolean; failures: number; lastFailure: number | null } {
    const current = this.failures.get(service);
    return {
      healthy: this.isHealthy(service),
      failures: current?.count || 0,
      lastFailure: current?.lastFailure || null,
    };
  }
}

export const serviceHealthTracker = new ServiceHealthTracker();

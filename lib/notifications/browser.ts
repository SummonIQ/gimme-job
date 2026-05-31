"use client";

/**
 * Request permission to show browser notifications
 * @returns A promise that resolves to a string representing the permission state
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  // Check if the browser supports notifications
  if (!("Notification" in window)) {
    console.error("This browser does not support notifications");
    return "denied";
  }

  // Check if we already have permission
  if (Notification.permission === "granted") {
    return "granted";
  }

  // Otherwise, ask for permission
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error("Error requesting notification permission:", error);
    return "denied";
  }
}

/**
 * Show a browser notification
 * @param title The title of the notification
 * @param options The options for the notification
 * @returns The Notification object or null if notifications are not supported or permitted
 */
export function showBrowserNotification(
  title: string,
  options: NotificationOptions = {}
): Notification | null {
  // Check if the browser supports notifications and permission is granted
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return null;
  }

  // Set default options
  const defaultOptions: NotificationOptions = {
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    silent: false,
  };

  // Create and show the notification
  try {
    const notification = new Notification(title, { ...defaultOptions, ...options });

    // Add click handler to focus the app and close the notification
    notification.onclick = () => {
      window.focus();
      notification.close();

      // If there's a URL in the data property, navigate to it
      if (options.data?.url) {
        window.location.href = options.data.url;
      }
    };

    return notification;
  } catch (error) {
    console.error("Error showing notification:", error);
    return null;
  }
}

/**
 * Checks if browser notifications are supported and permission is granted
 * @returns True if notifications are supported and permitted, false otherwise
 */
export function canShowNotifications(): boolean {
  return "Notification" in window && Notification.permission === "granted";
}

/**
 * Save browser notification preferences to localStorage
 * @param enabled Whether browser notifications are enabled
 */
export function saveBrowserNotificationPreference(enabled: boolean): void {
  try {
    localStorage.setItem("browserNotificationsEnabled", enabled ? "true" : "false");
  } catch (error) {
    console.error("Error saving browser notification preference:", error);
  }
}

/**
 * Get browser notification preferences from localStorage
 * @returns True if browser notifications are enabled, false otherwise
 */
export function getBrowserNotificationPreference(): boolean {
  try {
    return localStorage.getItem("browserNotificationsEnabled") === "true";
  } catch (error) {
    console.error("Error getting browser notification preference:", error);
    return false;
  }
}

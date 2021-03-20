import { jest } from '@jest/globals'
import * as notifications from './notifications'
jest.useFakeTimers();

test("basic notification", ()=>{
    document.body.innerHTML = '<div id="notification"></div>';
    let notificationElement = document.getElementById("notification")!;
    let notification = new notifications.GameNotification(notificationElement);

    let notificationText = "new text";

    notification.notify(notificationText);

    expect(notificationElement.hidden).toBe(false);
    expect(notificationElement.innerText).toBe(notificationText);

    jest.runAllTimers();

    expect(notificationElement.hidden).toBe(true);
})

test("custom display time", ()=>{
    document.body.innerHTML = '<div id="notification"></div>';
    let notificationElement = document.getElementById("notification")!;
    let notification = new notifications.GameNotification(notificationElement);

    let notificationText = "new text";

    notification.notify(notificationText, 2);

    jest.advanceTimersByTime(1);

    expect(notificationElement.hidden).toBe(false);

    jest.advanceTimersByTime(1);

    expect(notificationElement.hidden).toBe(true);
})

test("overlapping notification times", ()=>{
    document.body.innerHTML = '<div id="notification"></div>';
    let notificationElement = document.getElementById("notification")!;
    let notification = new notifications.GameNotification(notificationElement);

    let firstDisplayTime = 1;

    notification.notify("first notification", firstDisplayTime);

    let secondDisplayTime = 2;

    notification.notify("second notification", secondDisplayTime);
    expect(notificationElement.hidden).toBe(false);
    expect(notificationElement.innerText).toBe("second notification");

    jest.advanceTimersByTime(firstDisplayTime);
    expect(notificationElement.hidden).toBe(false);
    jest.advanceTimersByTime(secondDisplayTime - firstDisplayTime);
    expect(notificationElement.hidden).toBe(true);
})
import { jest } from "@jest/globals"
import * as notifications from "../../src/client/notifications"
jest.useFakeTimers()

const notificationHtml = '<div id="notification" class="notification"></div>'

test("basic notification", () => {
  document.body.innerHTML = notificationHtml
  const notificationElement = document.getElementById("notification")!
  const notification = new notifications.GameNotification("notification")

  const notificationText = "new text"

  notification.notify(notificationText)

  expect(notificationElement.hidden).toBe(false)
  expect(notificationElement.innerText).toBe(notificationText)

  jest.runAllTimers()

  expect(notificationElement.hidden).toBe(true)
})

test("custom display time", () => {
  document.body.innerHTML = notificationHtml
  const notificationElement = document.getElementById("notification")!
  const notification = new notifications.GameNotification("notification")

  const notificationText = "new text"

  notification.notify(notificationText, 2)

  jest.advanceTimersByTime(1)

  expect(notificationElement.hidden).toBe(false)

  jest.advanceTimersByTime(1)

  expect(notificationElement.hidden).toBe(true)
})

test("overlapping notification times", () => {
  document.body.innerHTML = notificationHtml
  const notificationElement = document.getElementById("notification")!
  const notification = new notifications.GameNotification("notification")

  const firstDisplayTime = 1

  notification.notify("first notification", firstDisplayTime)

  const secondDisplayTime = 2

  notification.notify("second notification", secondDisplayTime)
  expect(notificationElement.hidden).toBe(false)
  expect(notificationElement.innerText).toBe("second notification")

  jest.advanceTimersByTime(firstDisplayTime)
  expect(notificationElement.hidden).toBe(false)
  jest.advanceTimersByTime(secondDisplayTime - firstDisplayTime)
  expect(notificationElement.hidden).toBe(true)
})

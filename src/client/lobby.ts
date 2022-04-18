import * as Sentry from "@sentry/browser"

Sentry.init({ dsn: process.env.BROWSER_SENTRY })
if (process.env.SENTRY_TESTS == "true") {
  Sentry.captureException(new Error("sentry test in index.js"))
}

function showOnlyJoinContent() {
  const urlParameters: { [key: string]: string } = {}
  location.search
    .substring(1)
    .split("&")
    .forEach(function (item) {
      const tmp = item.split("=")
      urlParameters[tmp[0]] = decodeURIComponent(tmp[1])
    })
  const joinForm = document.getElementById("join-form")!
  if (urlParameters["code"]) {
    document.getElementById("make-area")!.hidden = true
    document.getElementById("area-divider")!.hidden = true
    const codeInput = <HTMLInputElement>(
      joinForm.querySelector('input[name="code"]')
    )
    codeInput.value = urlParameters["code"]
  } else {
    document.getElementById("make-area")!.hidden = false
  }
  if (urlParameters["username"]) {
    const usernameInput = <HTMLInputElement>(
      joinForm.querySelector('input[name="username"]')
    )
    usernameInput.value = urlParameters["username"]
  }
}

// don't use onload - because that waits for background image
if (document.readyState === "loading") {
  // Loading hasn't finished yet
  document.addEventListener("DOMContentLoaded", showOnlyJoinContent)
} else {
  // `DOMContentLoaded` has already fired
  showOnlyJoinContent()
}

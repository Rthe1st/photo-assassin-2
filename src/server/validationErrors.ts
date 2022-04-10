import { Response } from "express"

// import pkg from "handlebars"
// const { escapeExpression } = pkg
// import { Details } from "runtypes"

// function _detailsAsHtml(details: Details) {
//   let errorList = "<ul>"
//   if (Array.isArray(details)) {
//     for (const detail of details) {
//       if (typeof detail === "string") {
//         errorList += `<li>${escapeExpression(detail)}</li>`
//       } else {
//         errorList += `<li>${detailsAsHtml(detail)}</li>`
//       }
//     }
//   } else {
//     for (const key in details) {
//       const detail = details[key]
//       if (typeof detail === "string") {
//         errorList += `<li>${escapeExpression(key)}: ${escapeExpression(
//           detail
//         )}</li>`
//       } else {
//         errorList += `<li>${detailsAsHtml(detail)}</li>`
//       }
//     }
//   }
//   return errorList + "</ul>"
// }

export function returnError(res: Response, failureDetails: string) {
  res.render("error", {
    layout: false,
    helpers: {
      details: failureDetails,
    },
  })
  return
}

function showOnlyJoinContent() {
    let urlParameters = {}
    location.search
      .substr(1)
      .split("&")
      .forEach(function (item) {
        let tmp = item.split("=");
        urlParameters[tmp[0]] = decodeURIComponent(tmp[1]);
      });
    if (urlParameters["code"]) {
      document.getElementById('make-area').hidden = true;
      document.getElementById('area-divider').hidden = true;
      var joinForm = document.getElementById('join-form');
      var codeInput = (<HTMLInputElement>joinForm.querySelector('input[name="code"]'));
      codeInput.value = urlParameters["code"];
    } else {
      document.getElementById('make-area').hidden = false;
    }
    if (urlParameters["username"]) {
      var usernameInput = (<HTMLInputElement>joinForm.querySelector('input[name="username"]'));
      usernameInput.value = urlParameters["username"];
    }
  }

  // don't use onload - because that waits for background image
  if (document.readyState === 'loading') {  // Loading hasn't finished yet
    document.addEventListener('DOMContentLoaded', showOnlyJoinContent);
  } else {  // `DOMContentLoaded` has already fired
    showOnlyJoinContent();
  }
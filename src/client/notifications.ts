export class GameNotification{

    notificationClassName: string;
    defaultDisplayTime = 5000;
    // we use a callback to hide the notification bar X seconds after showing it
    // but what if another call to notify is made while we were waiting?
    // (the display time of those intervening calls will be reduced!)
    // hiding is the responsibility of the most recent call
    // each call to notify sets a new symbol
    // which it checks after it's timeout call back to see if any other calls have been made since
    lastSymbol = Symbol("default");

    constructor(notificationClassName: string){
        this.notificationClassName = notificationClassName;
    }

    notify(text: string, displayTime=this.defaultDisplayTime){
        for(let element of document.getElementsByClassName(this.notificationClassName) as HTMLCollectionOf<HTMLElement>){
            element.innerText = text;
            element.hidden = false;
        }
        const symbol = Symbol(text);
        this.lastSymbol = symbol

        setTimeout(()=>{
            // only hide if no other notify calls been made while we were waiting
            if(this.lastSymbol == symbol){
                for(let element of document.getElementsByClassName(this.notificationClassName) as HTMLCollectionOf<HTMLElement>){
                    element.hidden = true;
                }
            }
        }, displayTime);
    }
}
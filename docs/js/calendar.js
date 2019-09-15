"use strict";

/**
 * format a date according to google calendar's: YYYYMMDDTHHmmSS and return it as a string
 * @returns new date after operation
 */
Date.prototype.toGCalendar = function() {
    return this.toISOString().replace(/(-)|(\:)/g, "").split(".")[0] + "Z";
};

/**
 * return a URL for google chrome event adding from an event
 * @param {Extractor} extractor class that implements getName and getDescription from the event
 * @param {event object} event needs to have (at least) {from, to, location, download}
 * @param {*} repeat if undefined the even does not repeat overtime, otherwise it does (uses the same format as ics.js, so: repeat = { freq: "WEEKLY", until: stringFriendlyWithDate };)
 * https://richmarr.wordpress.com/2008/01/07/adding-events-to-users-calendars-part-2-web-calendars/
 */
function eventToGCalendar(events) {
    return events.map(event => {
        let recur = event.rrule === null ? "" : `&recur=RRULE:FREQ=${event.rrule.freq};INTERVAL=${event.rrule.interval};COUNT=${event.rrule.count}`;

        let dates = '';
        if (event.from && event.to)
            dates = `&dates=${(new Date(event.from)).toGCalendar()}/${(new Date(event.to)).toGCalendar()}`;

        return (`https://calendar.google.com/calendar/r/eventedit?text=${event.name}&location=${event.location}&details=${event.description}&sprop=name:${event.name}&sprop=website:${"https://github.com/msramalho/uoe-timetable-to-calendar"}${recur}${dates}`);
    });
}


/**
 * Returns an element object <a> for OneClick feature with a <img> child
 * @param {string} class_atr_a The class for <a> element
 * @param {string} class_atr_img The class for <img> child element
 * @param {string} service 'google' || 'outlook'. This is used to set the correct title and icon automatically
 * @param {string} url
 */
function generateOneClickDOM(class_atr_a, class_atr_img, service, urls, title) {
    var a = document.createElement("a");
    var img = document.createElement("img");

    // set class
    a.className = class_atr_a;
    img.className = class_atr_img;

    // set title and append an <img>
    if (service == "google") {
        img.setAttribute("alt", "google calendar icon");
        if (urls.length == 1) {
            a.setAttribute("title", "Add this single event to your Google Calendar in one click!");
            img.setAttribute("src", "icons/gcalendar.png");
        } else {
            a.setAttribute("title", `Add these ${urls.length} events to your Google Calendar in one click!\n(you have to enable pop-ups on this website)`);
            img.setAttribute("src", "icons/gcalendar_red.png");
        }
        a.setAttribute("data-toggle", "tooltip");
        a.setAttribute("data-placement", "left");
    }
    a.appendChild(img);

    // add href attribute to automatically set the pointer/cursor
    a.setAttribute("href", "#");
    if (title != undefined) a.innerHTML += title

    // add event listener
    let onClick = urls.map(url => `window.open('${encodeURI(url.replace(/'/g,"\""))}')`).join(";");
    a.setAttribute("onclick", onClick);
    return a;
}
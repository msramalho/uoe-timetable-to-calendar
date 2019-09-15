let classes = [];

let week_0_per_year = {
    2019: 38,
    2020: 38,
    2021: 38,
    2022: 38
}

function getSchoolYear() {
    let d = new Date();
    return d.getFullYear() - (d.getMonth() <= 6); // new school year after July
}

let week_0 = week_0_per_year[getSchoolYear()]; // get the current year's index of first week
// get the week number of "Sem1 week1" for later calculations
let sem1_week1, week_to_52 = (wn) => wn <= 52 ? wn : wn % 52;;

function fetchUrl() {
    let url = document.getElementById("url").value;
    get(url + "&format=json")
        .catch(res => {
            let message = "Please check Adblock, PrivacyBadger or similar apps are not blocking requests from this website!"
            if (res.status === 404) {
                message = `"${url}" was not found`;
            }
            alert(`Failed to fecth given URL (${res.status}): ${message}`)
        })
        .then(res => {
            res = cleanUpResponse(res); // clean text response
            try {
                classes = res = JSON.parse(res); // parse to JS object abd  assign to globally accessible variable
                // get the week number of "Sem1 week1" for later calculations
                sem1_week1 = parseInt(classes[0].weekLabels.find(w => w.week_label == "Sem1 wk1").week_no);
                res = groupByCourse(res); // group by course
                displayRes(res); // visualize results
            } catch (e) {
                return alert(`The url given does not lead to a valid JSON response. \n\n\n${e}`);
            }
        })

    function cleanUpResponse(res) {
        return res.split("\\/").join("");
    }

    function groupByCourse(res) {
        return groupBy(res, entry => entry.course_number);
        // return groupBy(res, entry => entry.course[0].full_code);
    }

    function groupBy(arr, groupByRule) {
        return arr.reduce(function(rv, x) {
            (rv[groupByRule(x)] = rv[groupByRule(x)] || []).push(x);
            return rv;
        }, []);
    }

    function get(url) {
        // https://stackoverflow.com/a/4033310/6196010
        return new Promise((resolve, reject) => {
            let xmlHttp = new XMLHttpRequest();
            xmlHttp.onreadystatechange = function() {
                if (xmlHttp.readyState == 4) {
                    if (xmlHttp.status == 200) resolve(xmlHttp.responseText)
                    else reject(xmlHttp)
                }
            }
            xmlHttp.open("GET", url, true); // true for asynchronous 
            xmlHttp.send(null);
        });
    }
}

function displayRes(res) {
    let text = `<h4 class="text-center mb-">Select your classes from the list below</h4>`;
    res.forEach((course) => {
        text += `
        <div class="form-check">
            <input class="form-check-input super" type="checkbox" checked="true" id="${course[0].course[0].full_code}">
            <label class="form-check-label" for="${course[0].course[0].full_code}">
            <h5>${course[0].course[0].name}</h5>
            </label>
        </div><ul>`;
        course.sort(compareClasses);
        course.forEach((_class) => {
            let events = getEventsFromClass(_class);
            let toDate = new Date(events[0].to).toTimeString();
            text += `
                <div class="form-check my-0">
                    <input class="form-check-input" type="checkbox" checked="true" id="${_class.id}">
                    <label class="form-check-label" data-toggle="tooltip" data-placement="top" title="${_class.week_label}" for="${_class.id}">
                    ${_class.name} <small>(${_class.day_verbose}: ${_class.start_verbose} to ${toDate.slice(0, 2)}:${toDate.slice(3, 5)})</small>
                    </label>
                    ${generateOneClickDOM("iconAnchor", "dropdownIcon", "google", eventToGCalendar(events), "").outerHTML}
                    </div>`;
        });
        text += `</ul>`
    });
    document.getElementById("events").innerHTML = text;
    addCheckBoxListeners();
    $('[data-toggle="tooltip"]').tooltip({
        delay: {
            "show": 250,
            "hide": 100
        }
    }); //enable tooltips
    $("#donwloadBtn").prop('disabled', false);

    function compareClasses(class1, class2) {
        if (class1.type == "Lecture") return -1 // 1 comes before
        if (class2.type == "Lecture") return 1 //2 comes before
        return class1.name < class2.name ? -1 : 1;
    }

    function addCheckBoxListeners() {
        $("input[type=checkbox].super").off();
        $("input[type=checkbox].super").on("change", (e) => {
            cbx = $(e.target);
            cbx.closest("div.form-check").next("ul").find(":checkbox").prop("checked", cbx.prop("checked"));
        });
    }
}


function generateIcal() {
    // get the ids of the checked check-boxes
    let checked_ids = Array.from(document.querySelectorAll('input[type=checkbox]:checked')).map(cbx => cbx.id)

    let ical = ics("uoe_timetable"); //creat ics instance
    classes
        .filter(_class => checked_ids.indexOf(_class.id) !== -1)
        .forEach(_class => {
            getEventsFromClass(_class).forEach(event => {
                ical.addEvent(event.name, event.description, event.location, event.from, event.to, event.rrule)
            })
        });
    if (!ical.download()) alert("No event selected");
}

function getEventsFromClass(_class) {
    // load all needed info
    let loc = _class.location[0];
    let first_week = _class.week_pattern.indexOf("1") - sem1_week1 + week_0;
    first_week_year = first_week <= 52 ? getSchoolYear() : getSchoolYear() + 1
    first_week = week_to_52(first_week);
    let from = getDateOfISOWeek(first_week, first_week_year);
    from.setDate(from.getDate() + _class.day); // in class 0 is monday, hence + 1
    from = setHoursMinutesFromClass(from, getHoursMinutesFromTimeIndex(_class.start));
    let to = new Date(from.getTime());
    to = setHoursMinutesFromClass(to, getHoursMinutesFromTimeIndex(_class.end));

    // generate multiples of 10 to insert in the regex and test the weekly repetition
    // some is like a forEach that exits when return true
    let res = null; //"Unexpected pattern: " + _class.week_pattern;
    [...Array(5).keys()].map(i => String(Math.pow(10, i))).some(pat => {
        let regex = new RegExp(`^0*(${pat})+0*$`);
        // console.log(`Testing for pattern: ${regex} on ${_class.week_pattern}`);
        if (regex.test(_class.week_pattern)) {
            res = [{
                name: `${_class.name} [${loc.room}]`,
                description: `${_class.desc} (campus: ${loc.campus})`,
                location: `${loc.building}, ${loc.room}`,
                from: from.toString(),
                to: to.toString(),
                rrule: {
                    freq: "WEEKLY",
                    count: _class.week_pattern.split("1").length - 1, // count matches
                    interval: pat.length
                }

            }]
            return true;
        }
    })
    //if the week pattern was irregular and therefore undetected before
    // must create individual events for each week,
    if (res === null) {
        res = _class.week_pattern.split("").map((x, i) => x == 1 ? i : -1).filter(x => x >= 0).map(w => {
            let wn = w - sem1_week1 + week_0;
            return week_to_52(wn); // because it is not 0-indexed
        }).map(wn => {
            let week_from_0 = wn - week_0;
            return {
                name: `${_class.name} [${loc.room}]`,
                description: `${_class.desc} (campus: ${loc.campus}) - week ${wn-week_0}`,
                location: `${loc.building}, ${loc.room}`,
                from: addWeeks(from, week_from_0).toString(),
                to: addWeeks(to, week_from_0).toString(),
                rrule: null // should remain here
            }
        });
    }
    return res;
}


function getDateOfISOWeek(w, y) {
    //https://stackoverflow.com/a/16591175/6196010
    let simple = new Date(y, 0, 1 + (w - 1) * 7);
    let dow = simple.getDay();
    let ISOweekStart = simple;
    if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    return ISOweekStart;
}

//receive a Date and hh:mm and update the dates hours and minutes
function setHoursMinutesFromClass(date, verbose) {
    let [h, m] = verbose.split(":").map(x => parseInt(x, 10));
    let res = (new Date(date.getTime()))
    res.setHours(h, m);
    return res;
}
//receive a Date and add W weeks to it
function addWeeks(date, W) {
    let new_date = new Date(date.getTime());
    new_date.setDate(date.getDate() + W * 7);
    return new_date;
}

function getHoursMinutesFromTimeIndex(val) {
    return {
        18: "09:00",
        19: "09:50",
        20: "10:00",
        21: "10:50",
        22: "11:10",
        23: "12:00",
        24: "12:10",
        25: "13:00",
        26: "13:10",
        27: "14:00",
        28: "14:10",
        29: "15:00",
        30: "15:10",
        31: "16:00",
        32: "16:10",
        33: "17:00",
        34: "17:10",
        35: "18:00",
        36: "18:10",
        37: "19:00",
        38: "19:10",
        39: "20:00",
    } [val]
}

$(function() {
    $('[data-toggle="tooltip"]').tooltip()
})
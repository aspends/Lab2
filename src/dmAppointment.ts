import { title } from "process";
import { text } from "stream/consumers";
import { MachineConfig, send, Action, assign } from "xstate";

function say(text: string): Action<SDSContext, SDSEvent> {
  return send((_context: SDSContext) => ({ type: "SPEAK", value: text }));
}

interface Grammar {
  [index: string]: {
    intent: string;
    entities: {
      [index: string]: string;
    };
  };
}

const grammar: Grammar = {
  "create a new meeting" : {
    intent: "None",
    entities: { begining: "creating a meeting"}
  },
  "who is Taylor Swift" : {
    intent: "None",
    entities: { request: "who_it_is", celeb: "Kenedy"}
  },
  lecture: {
    intent: "None",
    entities: { title: "Dialogue systems lecture" },
  },
  lunch: {
    intent: "None",
    entities: { title: "Lunch at the canteen" },
  },
  "on monday": {
    intent: "None",
    entities: { day: "Monday"}
  },
  "on tuesday": {
    intent: "None",
    entities: { day: "Tuesday"}
  },
  "on wednesday": {
    intent: "None",
    entities: { day: "Wednesday"},
  },
  "on thursday": {
    intent: "None",
    entities: { day: "Thursday"}
  },
  "on friday": {
    intent: "None",
    entities: { day: "Friday" },
  },
  "on saturday": {
    intent: "None",
    entities: { day: "Saturday" },
  },
  "on sunday": {
    intent: "None",
    entities: {day: "Sunday"},
  },
  "10 in the morning": {
    intent: "None",
    entities: { time: "10:00" },
  },
  "cars":{
    intent: "topic",
    entities: { title: "cars"},
  },
  "homework":{
    intent: "topic",
    entities: { title: "homework"},
  },
  "january 9th":{
    intent: "date",
    entities: {day: "January 9th"},
  },
  "tomorrow": {
    intent: "date",
    entities: {day: "tomorrow"},
  },
  "no":{
    intent: "duration_n",
    entities: {duration_n: "no"},
  },
  "yes": {
    intent: "duration_y",
    entities: {duration_y: "yes"},
  },
  "2:00 PM.": {
    intent: "time",
    entities: {time: "2pm"},
  },
  "yes, please": {
    intent: "endline",
    entities: {endline: "yes"},
  },

};

const getEntity = (context: SDSContext, entity: string) => {
  // lowercase the utterance and remove tailing "."
  let u = context.recResult[0].utterance.toLowerCase().replace(/.$/g, "");
  if (u in grammar) {
    if (entity in grammar[u].entities) {
      return grammar[u].entities[entity];
    }
  }
  return false;
};

export const dmMachine: MachineConfig<SDSContext, any, SDSEvent> = {
  initial: "idle",
  states: {
    idle: {
      on: {
        CLICK: "init",
      },
    },
    init: {
      on: {
        TTS_READY: "greeting",
        CLICK: "greeting",
      },
    },
    greeting: {
      initial: "prompt",
      on: {
        RECOGNISED: [
          {
            target: "welcome",
            cond: (context) => !!getEntity(context, "begining"),
            actions: assign({
              begining: (context) => getEntity(context, "begining"),
            }),
          },
          {
            target: ".information",
            actions: assign({celeb:
              context => {return context.recResult[0].utterance},
          }),
          },
          {
            target: ".nomatch",
          },
        ],
        TIMEOUT: ".prompt",
      },
      states: {
        prompt: {
          entry: say("Hello, Stas! What would you like to do today?"),
          on: {ENDSPEECH: "ask" },
        },
        ask: {
          entry: send("LISTEN"),
        },
        nomatch: {
          entry: say("Sorry, I didn't quite get it. What was it?"),
          on: { ENDSPEECH: "ask"},
        },
        information: {
          invoke: {
            id: 'getInformation',
            src: (context, event) => kbRequest(context.celeb),
            onDone: [{
              target: 'who_it_is',
              cond: (context, event) => event.data.Abstract !== "",
              actions: assign({ information: (context, event) => event.data})
            },
            {
              target: 'no_name',
            },
          ],
          onError: {
            target: 'no_name',
            }
          }
        },
    who_it_is: {
      entry: send((context) => ({
        type: "SPEAK",
        value: `${context.celeb} ${context.information.Abstract}`,
        })),
      on: { ENDSPEECH: "#meeting" },
    },
    no_name: {
      entry: send((context) => ({
        type: "SPEAK",
        value: `I could not find anything about ${context.celeb}.`
      })),
      on: {ENDSPEECH: "prompt"}
    },
  }, 
},
  meeting: {
    id: "meeting",
      initial: "prompt",
      on: {
        RECOGNISED: [
          {
            target: "whichday",
            cond: (context) => !!getEntity(context, "duration_y"),
            actions: assign({
              duration_y: (context) => getEntity(context, "duration_y"),
            }),
          },
          {
            target: ".nomatch",
          },
        ],
        TIMEOUT: ".prompt",
      },
      states: {
        prompt: {
          entry: say("Do you want to meet them?"),
          on: {ENDSPEECH: "ask" },
        },
        ask: {
          entry: send("LISTEN"),
        },
        nomatch: {
          entry: say('So yes?'),
          on: {ENDSPEECH: "ask"},
        },
      },
    },
    welcome: {
      initial: "prompt",
      on: {
        RECOGNISED: [
          {
            target: "info",
            cond: (context) => !!getEntity(context, "title"),
            actions: assign({
              title: (context) => getEntity(context, "title"),
            }),
          },
          {
            target: ".nomatch",
          },
        ],
        TIMEOUT: ".prompt",
      },
      states: {
        prompt: {
          entry: say("Let's create a meeting. What is it about?"),
          on: { ENDSPEECH: "ask" },
        },
        ask: {
          entry: send("LISTEN"),
        },
        nomatch: {
          entry: say(
            "Sorry, I don't know what it is. Tell me something I know."
          ),
          on: { ENDSPEECH: "ask" },
        },
      },
    }, 
    info: {
      entry: send((context) => ({
        type: "SPEAK",
        value: `OK, so ${context.title}, huh?`,
        })),
      on: { ENDSPEECH: "whichday" },
      },
    whichday: {
        initial: "prompt",
        on: {
          RECOGNISED: [
            {
              target: "Date",
              cond: (context) => !!getEntity(context, "day"),
              actions: assign({
                day: (context) => getEntity(context, "day"),
              }),
            },
            {
              target: ".nomatch",
            },
          ],
          TIMEOUT: ".prompt",
        },
        states: {
          prompt: {
            entry: say("On which day is it?"),
            on: { ENDSPEECH: "ask" },
          },
          ask: {
            entry: send("LISTEN"),
          },
          nomatch: {
            entry: say(
              "Are you sure you are saying it correcrly? Try again!"
            ),
            on: { ENDSPEECH: "ask" },
          },
        },
      }, 
    Date: {
        entry: send((context) => ({
          type: "SPEAK",
          value: `OK, ${context.day} sounds like a good day!`,
          })),
        on: { ENDSPEECH: "askDuration" },
          },
    askDuration: {
        initial: "prompt",
        on: {
          RECOGNISED: [
            {
              target: "meeting_created_whole_day",
              cond: (context) => !!getEntity(context, "duration_y"),
              actions: assign({
                duration_y: (context) => getEntity(context, "duration_y"),
              }),
            },
            {
              target: "what_time",
              cond: (context) => !!getEntity(context, "duration_n"),
              actions: assign({
                duration_n: (context) => getEntity(context, "duration_n"),
              }),
            },
            {
              target: ".nomatch",
            },
          ],
          TIMEOUT: ".prompt",
        },
        states: {
          prompt: {
            entry: say("Will it take the whole day?"),
            on: { ENDSPEECH: "ask" },
          },
          ask: {
            entry: send("LISTEN"),
          },
          nomatch: {
            entry: say(
              "Sorry, come again?"
            ),
            on: { ENDSPEECH: "ask" },
          },
        },
      },
    meeting_created_whole_day: {
      initial: "prompt",
      on: {
        RECOGNISED: [
          {
            target: "welcome",
            cond: (context) => !!getEntity(context, "duration_n"),
              actions: assign({
                duration_n: (context) => getEntity(context, "duration_n"),
              }),
            },
            {
              target: "endline",
              cond: (context) => !!getEntity(context, "duration_y"),
              actions: assign({
                duration_y: (context) => getEntity(context, "duration_y"),
              }),
            },
            {
              target: ".nomatch",
            },
          ],
          TIMEOUT: ".prompt",
        },
        states: {
          prompt: {
            entry: send((context) => ({
              type: "SPEAK",
              value: `OK, do you want me to create a meeting "${context.title}" on ${context.day} for the whole day?`,
              })),
            on: { ENDSPEECH: "ask" },
              },
          ask: {
            entry: send("LISTEN"),
          },
          nomatch: {
            entry: say(
              "So yes or no?"
            ),
            on: { ENDSPEECH: "ask" },
          },
        },
      },
    what_time: {
          initial: "prompt",
          on: {
            RECOGNISED: [
              {
                target: "meeting_specific_time",
                cond: (context) => !!getEntity(context, "time"),
                actions: assign({
                  time: (context) => getEntity(context, "time"),
                }),
              },
              {
                target: ".nomatch",
              },
            ],
            TIMEOUT: ".prompt",
          },
          states: {
            prompt: {
              entry: say("What time is your meeting?"),
              on: { ENDSPEECH: "ask" },
            },
            ask: {
              entry: send("LISTEN"),
            },
            nomatch: {
              entry: say(
                "Could you say that again?"
              ),
              on: { ENDSPEECH: "ask" },
            },
          },
        },
      meeting_specific_time: {
        initial: "prompt",
        on: {
          RECOGNISED: [
            {
              target: "welcome",
              cond: (context) => !!getEntity(context, "duration_n"),
                actions: assign({
                  duration_n: (context) => getEntity(context, "duration_n"),
                }),
              },
                {
                  target: "endline",
                  cond: (context) => !!getEntity(context, "duration_y"),
                  actions: assign({
                    duration_y: (context) => getEntity(context, "duration_y"),
                  }),
                },
                {
                  target: "endline",
                  cond: (context) => !!getEntity(context, "endline"),
                  actions: assign({
                    endline: (context) => getEntity(context, "endline"),
                  }),
                },
                {
                  target: ".nomatch",
                },
              ],
              TIMEOUT: ".prompt",
            },
            states: {
              prompt: {
                entry: send((context) => ({
                  type: "SPEAK",
                  value: `OK, do you want me to create a meeting titled ${context.title} on ${context.day} at ${context.time}?`,
                  })),
                on: { ENDSPEECH: "ask" },
                  },
              ask: {
                entry: send("LISTEN"),
              },
              nomatch: {
                entry: say(
                  "So yes or no?"
                ),
                on: { ENDSPEECH: "ask" },
              },
            },
          },
    endline: {
          entry: send((context) => ({
            type: "SPEAK",
            value: `OK, your meeting has been created!`,
            })),
          },  
    },
};

const kbRequest = (text: string) =>
  fetch(
    new Request(
      `https://cors.eu.org/https://api.duckduckgo.com/?q=${text}&format=json&skip_disambig=1`
    )
  ).then((data) => data.json());

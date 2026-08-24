// Auto-generiert von tools/build-data.py aus data/Workoutplan_mit_Bodyweight_Equivalent.xlsx.
// Nicht von Hand bearbeiten - Plan in der Excel aendern und neu generieren.
export const EXERCISES = [
  {
    "id": "goblet-squat",
    "group": "Beine",
    "weight": 20,
    "step": 2.5,
    "weightNote": "eine Hantel",
    "equip": "goblet",
    "db": {
      "name": "Goblet Squat",
      "reps": "8–12",
      "equip": "Kurzhantel",
      "cue": "Hantel senkrecht vor der Brust halten, Ellenbogen zwischen den Knien führen. Tief absitzen, Rumpf aufrecht, Fersen am Boden.",
      "rest": 150,
      "pattern": "squat",
      "shares": {
        "quads": 1.0,
        "glutes": 0.55,
        "abs": 0.35,
        "hamstrings": 0.15
      },
      "muscles": [
        "quads",
        "glutes",
        "abs",
        "hamstrings"
      ]
    },
    "bw": {
      "name": "1½-Wdh. Bodyweight Squat",
      "reps": "12–25",
      "equip": "Ohne Gerät",
      "cue": "1½-Wiederholungen: tief absitzen, nur zur Hälfte hoch, wieder tief, dann ganz hoch. Das zählt als EINE Wiederholung. Tempo bewusst langsam.",
      "rest": 150,
      "pattern": "squatbw",
      "shares": {
        "quads": 1.0,
        "glutes": 0.55,
        "abs": 0.35,
        "hamstrings": 0.15
      },
      "muscles": [
        "quads",
        "glutes",
        "abs",
        "hamstrings"
      ]
    }
  },
  {
    "id": "sliding-leg-curl",
    "group": "Beinbeuger",
    "weight": null,
    "step": null,
    "weightNote": null,
    "equip": null,
    "db": {
      "name": "Sliding Leg Curl",
      "reps": "8–15",
      "equip": "Slider/Handtuch",
      "cue": "Rücken am Boden, Fersen auf Slidern. Hüfte oben halten und Fersen langsam wegschieben, dann kontrolliert heranziehen.",
      "rest": 120,
      "pattern": "legcurl",
      "shares": {
        "hamstrings": 1.0,
        "glutes": 0.5,
        "abs": 0.3
      },
      "muscles": [
        "hamstrings",
        "glutes",
        "abs"
      ]
    },
    "bw": {
      "name": "Sliding Leg Curl",
      "reps": "8–15",
      "equip": "Slider/Handtuch",
      "cue": "Identisch. Hüfte darf nie absacken – das ist der eigentliche Reiz. Langsam ausstrecken (3 s).",
      "rest": 120,
      "pattern": "legcurl",
      "shares": {
        "hamstrings": 1.0,
        "glutes": 0.5,
        "abs": 0.3
      },
      "muscles": [
        "hamstrings",
        "glutes",
        "abs"
      ]
    }
  },
  {
    "id": "gewichtete-liegestuetze",
    "group": "Brust",
    "weight": 10,
    "step": 1.25,
    "weightNote": "Zusatzgewicht",
    "equip": "backplate",
    "db": {
      "name": "Gewichtete Liegestütze",
      "reps": "8–15",
      "equip": "Zusatzgewicht",
      "cue": "Scheibe/Rucksack auf dem oberen Rücken. Körper bleibt eine Linie, Ellenbogen ca. 45°.",
      "rest": 150,
      "pattern": "pushup",
      "shares": {
        "chest": 1.0,
        "triceps": 0.6,
        "delts": 0.45
      },
      "muscles": [
        "chest",
        "triceps",
        "delts"
      ]
    },
    "bw": {
      "name": "Langsame Liegestütze (3 s ablassen)",
      "reps": "8–20",
      "equip": "Ohne Gerät",
      "cue": "3 Sekunden kontrolliert ablassen, kurz am Boden entspannen, explosiv hoch. Die Zeit unter Spannung ersetzt das Gewicht.",
      "rest": 150,
      "pattern": "pushup",
      "shares": {
        "chest": 1.0,
        "triceps": 0.6,
        "delts": 0.45
      },
      "muscles": [
        "chest",
        "triceps",
        "delts"
      ]
    }
  },
  {
    "id": "chin-ups",
    "group": "Rücken/Bizeps",
    "weight": null,
    "step": null,
    "weightNote": null,
    "equip": null,
    "db": {
      "name": "Chin-ups",
      "reps": "5–10",
      "equip": "Klimmzugstange",
      "cue": "Untergriff, schulterbreit. Aus dem vollen Hang starten, Brust zur Stange, kontrolliert ablassen.",
      "rest": 180,
      "pattern": "pullup",
      "shares": {
        "lats": 1.0,
        "biceps": 0.65,
        "traps": 0.3,
        "rearDelts": 0.15
      },
      "muscles": [
        "lats",
        "biceps",
        "traps",
        "rearDelts"
      ]
    },
    "bw": {
      "name": "Chin-ups",
      "reps": "5–10",
      "equip": "Klimmzugstange",
      "cue": "Identisch. Zu schwer? Negativ-Wiederholungen (5 s ablassen) oder Füße auf einem Stuhl abstützen.",
      "rest": 180,
      "pattern": "pullup",
      "shares": {
        "lats": 1.0,
        "biceps": 0.65,
        "traps": 0.3,
        "rearDelts": 0.15
      },
      "muscles": [
        "lats",
        "biceps",
        "traps",
        "rearDelts"
      ]
    }
  },
  {
    "id": "sitzendes-seitheben",
    "group": "Schulter",
    "weight": 6,
    "step": 1,
    "weightNote": "je Hand",
    "equip": "dumbbells",
    "db": {
      "name": "Sitzendes Seitheben",
      "reps": "12–20",
      "equip": "Kurzhanteln",
      "cue": "Sitzend, kein Schwung. Bis Schulterhöhe anheben, kleiner Finger leicht höher, langsam senken.",
      "rest": 120,
      "pattern": "lateral",
      "shares": {
        "delts": 1.0,
        "traps": 0.2
      },
      "muscles": [
        "delts",
        "traps"
      ]
    },
    "bw": {
      "name": "Pike Push-ups",
      "reps": "6–15",
      "equip": "Ohne Gerät",
      "cue": "Pike Push-ups: Hüfte hoch, umgedrehtes V, Scheitel Richtung Boden senken. Füße erhöhen macht es schwerer.",
      "rest": 120,
      "pattern": "pike",
      "shares": {
        "delts": 1.0,
        "triceps": 0.6,
        "traps": 0.2
      },
      "muscles": [
        "delts",
        "triceps",
        "traps"
      ]
    }
  },
  {
    "id": "liegende-trizepsstrecker",
    "group": "Trizeps",
    "weight": 8,
    "step": 1,
    "weightNote": "je Hand",
    "equip": "dumbbells",
    "db": {
      "name": "Liegende Trizepsstrecker",
      "reps": "8–15",
      "equip": "Kurzhanteln/SZ",
      "cue": "Rücken am Boden/Bank, Oberarme fixiert. Nur im Ellenbogen beugen, Gewicht Richtung Stirn senken.",
      "rest": 120,
      "pattern": "triceps",
      "shares": {
        "triceps": 1.0
      },
      "muscles": [
        "triceps"
      ]
    },
    "bw": {
      "name": "Bodyweight Trizeps Extensions an niedriger Stange",
      "reps": "8–15",
      "equip": "Niedrige Stange",
      "cue": "Hände auf einer niedrigen Stange, Körper schräg. Ellenbogen beugen bis der Kopf unter die Stange geht, dann strecken. Steilerer Winkel = leichter.",
      "rest": 120,
      "pattern": "tricepsbar",
      "shares": {
        "triceps": 1.0,
        "chest": 0.3
      },
      "muscles": [
        "triceps",
        "chest"
      ]
    }
  },
  {
    "id": "einbeiniges-stehendes-wadenheben",
    "group": "Waden",
    "weight": 12,
    "step": 2,
    "weightNote": "eine Hantel",
    "equip": "onehand",
    "db": {
      "name": "Einbeiniges stehendes Wadenheben",
      "reps": "10–20 je Bein",
      "equip": "Kurzhantel",
      "cue": "Auf einer Stufe, Ferse tief absenken. Ganz hoch auf den Ballen, oben 1 s halten.",
      "rest": 90,
      "pattern": "calf1",
      "shares": {
        "calves": 1.0
      },
      "muscles": [
        "calves"
      ]
    },
    "bw": {
      "name": "Einbeiniges Wadenheben",
      "reps": "15–30 je Bein",
      "equip": "Ohne Gerät",
      "cue": "Ohne Gewicht, dafür deutlich mehr Wiederholungen. Volle Dehnung unten, 1 s Pause oben – bis es wirklich brennt.",
      "rest": 90,
      "pattern": "calf1",
      "shares": {
        "calves": 1.0
      },
      "muscles": [
        "calves"
      ]
    }
  },
  {
    "id": "wadenheben-gebeugtes-knie",
    "group": "Waden (Soleus)",
    "weight": 12,
    "step": 2,
    "weightNote": "eine Hantel",
    "equip": "onehand",
    "db": {
      "name": "Wadenheben gebeugtes Knie",
      "reps": "12–20",
      "equip": "Kurzhantel",
      "cue": "Knie ca. 30° gebeugt halten und so das Wadenheben ausführen – trifft den tiefen Wadenmuskel.",
      "rest": 90,
      "pattern": "calfbent",
      "shares": {
        "calves": 1.0
      },
      "muscles": [
        "calves"
      ]
    },
    "bw": {
      "name": "Wadenheben mit gebeugtem Knie",
      "reps": "15–30",
      "equip": "Ohne Gerät",
      "cue": "Gleiche gebeugte Knieposition, mehr Wiederholungen, langsames Tempo. Optional einbeinig für mehr Last.",
      "rest": 90,
      "pattern": "calfbent",
      "shares": {
        "calves": 1.0
      },
      "muscles": [
        "calves"
      ]
    }
  },
  {
    "id": "fersenerhoehter-goblet-squat",
    "group": "Beine",
    "weight": 20,
    "step": 2.5,
    "weightNote": "eine Hantel",
    "equip": "goblet",
    "db": {
      "name": "Fersenerhöhter Goblet Squat",
      "reps": "8–12",
      "equip": "Kurzhantel + Erhöhung",
      "cue": "Fersen 2–4 cm erhöht. Dadurch mehr Quadrizeps und größere Tiefe. Knie darf über die Zehen wandern.",
      "rest": 150,
      "pattern": "squat",
      "shares": {
        "quads": 1.0,
        "glutes": 0.45,
        "abs": 0.3
      },
      "muscles": [
        "quads",
        "glutes",
        "abs"
      ]
    },
    "bw": {
      "name": "Fersenerhöhter 1½-Wdh. Bodyweight Squat",
      "reps": "12–25",
      "equip": "Erhöhung (Buch/Keil)",
      "cue": "Fersen erhöht, gleiche 1½-Technik. Betont den vorderen Oberschenkel deutlich stärker.",
      "rest": 150,
      "pattern": "squatbw",
      "shares": {
        "quads": 1.0,
        "glutes": 0.45,
        "abs": 0.3
      },
      "muscles": [
        "quads",
        "glutes",
        "abs"
      ]
    }
  },
  {
    "id": "sz-curls",
    "group": "Bizeps",
    "weight": 15,
    "step": 2.5,
    "weightNote": "Stange gesamt",
    "equip": "barbell",
    "db": {
      "name": "SZ-Curls",
      "reps": "8–15",
      "equip": "SZ-Stange",
      "cue": "Ellenbogen am Körper, Oberkörper still. Kontrolliert ablassen, kein Schwung.",
      "rest": 120,
      "pattern": "curl",
      "shares": {
        "biceps": 1.0
      },
      "muscles": [
        "biceps"
      ]
    },
    "bw": {
      "name": "Enge supinierte Chin-ups",
      "reps": "5–10",
      "equip": "Klimmzugstange",
      "cue": "Enge supinierte Chin-ups: Untergriff, Hände dicht beieinander. Bewusst über den Bizeps ziehen, langsam ablassen.",
      "rest": 120,
      "pattern": "pullup",
      "shares": {
        "biceps": 1.0,
        "lats": 0.7,
        "traps": 0.2
      },
      "muscles": [
        "biceps",
        "lats",
        "traps"
      ]
    }
  },
  {
    "id": "gewichtete-crunches",
    "group": "Bauch",
    "weight": 5,
    "step": 1.25,
    "weightNote": "Zusatzgewicht",
    "equip": "plate",
    "db": {
      "name": "Gewichtete Crunches",
      "reps": "10–20",
      "equip": "Zusatzgewicht",
      "cue": "Gewicht vor der Brust oder hinter dem Kopf. Nur die Brustwirbelsäule einrollen, nicht die Hüfte beugen.",
      "rest": 90,
      "pattern": "crunch",
      "shares": {
        "abs": 1.0
      },
      "muscles": [
        "abs"
      ]
    },
    "bw": {
      "name": "Crunches",
      "reps": "15–30",
      "equip": "Ohne Gerät",
      "cue": "Ohne Gewicht, dafür mehr Wiederholungen und 2 s Halten in der Endposition. Arme über dem Kopf macht es schwerer.",
      "rest": 90,
      "pattern": "crunch",
      "shares": {
        "abs": 1.0
      },
      "muscles": [
        "abs"
      ]
    }
  },
  {
    "id": "einbeiniger-sliding-leg-curl",
    "group": "Beinbeuger",
    "weight": null,
    "step": null,
    "weightNote": null,
    "equip": null,
    "db": {
      "name": "Einbeiniger Sliding Leg Curl",
      "reps": "6–12 je Bein",
      "equip": "Slider/Handtuch",
      "cue": "Wie beidbeinig, aber nur ein Fuß am Boden. Das freie Bein angewinkelt in der Luft halten.",
      "rest": 120,
      "pattern": "legcurl1",
      "shares": {
        "hamstrings": 1.0,
        "glutes": 0.5,
        "abs": 0.35
      },
      "muscles": [
        "hamstrings",
        "glutes",
        "abs"
      ]
    },
    "bw": {
      "name": "Einbeiniger Sliding Leg Curl",
      "reps": "6–12 je Bein",
      "equip": "Slider/Handtuch",
      "cue": "Identisch. Wenn das Herausschieben zu schwer ist: exzentrisch einbeinig, konzentrisch mit beiden Beinen zurück.",
      "rest": 120,
      "pattern": "legcurl1",
      "shares": {
        "hamstrings": 1.0,
        "glutes": 0.5,
        "abs": 0.35
      },
      "muscles": [
        "hamstrings",
        "glutes",
        "abs"
      ]
    }
  },
  {
    "id": "fuesse-erhoehte-liegestuetze",
    "group": "Brust (oben)",
    "weight": null,
    "step": null,
    "weightNote": null,
    "equip": null,
    "db": {
      "name": "Füße-erhöhte Liegestütze",
      "reps": "8–15",
      "equip": "Erhöhung",
      "cue": "Füße auf Bank/Stuhl. Je höher die Füße, desto mehr obere Brust und Schulter.",
      "rest": 150,
      "pattern": "pushupfeet",
      "shares": {
        "chest": 1.0,
        "delts": 0.6,
        "triceps": 0.55
      },
      "muscles": [
        "chest",
        "delts",
        "triceps"
      ]
    },
    "bw": {
      "name": "Füße-erhöhte Liegestütze",
      "reps": "8–20",
      "equip": "Erhöhung",
      "cue": "Identisch. Für mehr Reiz Füße höher stellen oder langsamer ablassen.",
      "rest": 150,
      "pattern": "pushupfeet",
      "shares": {
        "chest": 1.0,
        "delts": 0.6,
        "triceps": 0.55
      },
      "muscles": [
        "chest",
        "delts",
        "triceps"
      ]
    }
  },
  {
    "id": "floor-press",
    "group": "Brust/Trizeps",
    "weight": 14,
    "step": 2,
    "weightNote": "je Hand",
    "equip": "dumbbells",
    "db": {
      "name": "Floor Press",
      "reps": "6–12",
      "equip": "Kurzhanteln",
      "cue": "Rücken am Boden, Oberarme setzen kurz ab. Schont die Schulter, betont den Trizeps-Lockout.",
      "rest": 180,
      "pattern": "press",
      "shares": {
        "chest": 1.0,
        "triceps": 0.7,
        "delts": 0.35
      },
      "muscles": [
        "chest",
        "triceps",
        "delts"
      ]
    },
    "bw": {
      "name": "Liegestütze",
      "reps": "8–20",
      "equip": "Ohne Gerät",
      "cue": "Saubere Liegestütze mit kurzer Pause in der tiefsten Position – gleicher Bewegungsstopp wie beim Floor Press.",
      "rest": 150,
      "pattern": "pushup",
      "shares": {
        "chest": 1.0,
        "triceps": 0.6,
        "delts": 0.45
      },
      "muscles": [
        "chest",
        "triceps",
        "delts"
      ]
    }
  },
  {
    "id": "einarmiges-kh-rudern",
    "group": "Rücken",
    "weight": 16,
    "step": 2,
    "weightNote": "je Hand",
    "equip": "onehand",
    "db": {
      "name": "Einarmiges KH-Rudern",
      "reps": "8–12 je Seite",
      "equip": "Kurzhantel",
      "cue": "Eine Hand abgestützt, Rücken flach. Ellenbogen eng am Körper nach hinten ziehen, oben Schulterblatt zusammenziehen.",
      "rest": 150,
      "pattern": "row",
      "shares": {
        "lats": 1.0,
        "biceps": 0.5,
        "traps": 0.5,
        "rearDelts": 0.35
      },
      "muscles": [
        "lats",
        "biceps",
        "traps",
        "rearDelts"
      ]
    },
    "bw": {
      "name": "Inverted Rows an sicherer niedriger Stange",
      "reps": "8–15",
      "equip": "Niedrige Stange/Tisch",
      "cue": "Inverted Rows: unter eine stabile niedrige Stange (oder Tischkante) legen, Körper gerade, Brust zur Stange ziehen. Schwerer: Füße erhöhen.",
      "rest": 150,
      "pattern": "invrow",
      "shares": {
        "lats": 1.0,
        "biceps": 0.5,
        "traps": 0.5,
        "rearDelts": 0.35
      },
      "muscles": [
        "lats",
        "biceps",
        "traps",
        "rearDelts"
      ]
    }
  },
  {
    "id": "hip-thrust",
    "group": "Gesäß",
    "weight": 20,
    "step": 2.5,
    "weightNote": "auf der Hüfte",
    "equip": "hipbar",
    "db": {
      "name": "Hip Thrust",
      "reps": "8–15",
      "equip": "Kurzhantel",
      "cue": "Schulterblätter auf einer Bank/Couch, Hantel auf der Hüfte. Oben Gesäß fest anspannen, Rippen unten lassen.",
      "rest": 150,
      "pattern": "thrust",
      "shares": {
        "glutes": 1.0,
        "hamstrings": 0.5
      },
      "muscles": [
        "glutes",
        "hamstrings"
      ]
    },
    "bw": {
      "name": "Einbeiniger Hip Thrust",
      "reps": "10–20 je Bein",
      "equip": "Ohne Gerät",
      "cue": "Einbeinig ausführen, freies Bein angewinkelt. Oben 1–2 s halten – ersetzt die fehlende Zusatzlast.",
      "rest": 150,
      "pattern": "thrust1",
      "shares": {
        "glutes": 1.0,
        "hamstrings": 0.5
      },
      "muscles": [
        "glutes",
        "hamstrings"
      ]
    }
  },
  {
    "id": "reverse-fly",
    "group": "Schulter (hinten)",
    "weight": 5,
    "step": 1,
    "weightNote": "je Hand",
    "equip": "dumbbells",
    "db": {
      "name": "Reverse Fly",
      "reps": "12–20",
      "equip": "Kurzhanteln",
      "cue": "Vorgebeugt, leichte Gewichte. Arme fast gestreckt seitlich öffnen, Bewegung aus dem Schulterblatt.",
      "rest": 120,
      "pattern": "reversefly",
      "shares": {
        "rearDelts": 1.0,
        "traps": 0.6
      },
      "muscles": [
        "rearDelts",
        "traps"
      ]
    },
    "bw": {
      "name": "Prone Reverse Fly / Reverse Snow Angels",
      "reps": "12–25",
      "equip": "Ohne Gerät",
      "cue": "Bauchlage, Arme angehoben, Reverse Snow Angels: Arme langsam vom Kopf bis zur Hüfte und zurück führen, ohne den Boden zu berühren.",
      "rest": 120,
      "pattern": "snowangel",
      "shares": {
        "rearDelts": 1.0,
        "traps": 0.6
      },
      "muscles": [
        "rearDelts",
        "traps"
      ]
    }
  },
  {
    "id": "sitzendes-schulterdruecken",
    "group": "Schulter",
    "weight": 10,
    "step": 2,
    "weightNote": "je Hand",
    "equip": "dumbbells",
    "db": {
      "name": "Sitzendes Schulterdrücken",
      "reps": "6–12",
      "equip": "Kurzhanteln",
      "cue": "Aufrecht sitzen, Rippen unten lassen. Hanteln von Schulterhöhe senkrecht nach oben, Ellenbogen leicht vor der Schulterachse. Oben nicht in den Rücken ausweichen.",
      "rest": 180,
      "pattern": "ohp",
      "shares": {
        "delts": 1.0,
        "triceps": 0.6,
        "traps": 0.3
      },
      "muscles": [
        "delts",
        "triceps",
        "traps"
      ]
    },
    "bw": {
      "name": "Füße-erhöhte Pike Push-ups",
      "reps": "5–12",
      "equip": "Erhöhung",
      "cue": "Füße auf eine Erhöhung, Hüfte hoch, Scheitel Richtung Boden. Je höher die Füße, desto mehr Last auf der Schulter.",
      "rest": 180,
      "pattern": "pike",
      "shares": {
        "delts": 1.0,
        "triceps": 0.65,
        "chest": 0.3,
        "traps": 0.25
      },
      "muscles": [
        "delts",
        "triceps",
        "chest",
        "traps"
      ]
    }
  },
  {
    "id": "rumaenisches-kreuzheben",
    "group": "Beine",
    "weight": 12,
    "step": 2,
    "weightNote": "je Hand",
    "equip": "dumbbells",
    "db": {
      "name": "Rumänisches Kreuzheben",
      "reps": "8–12",
      "equip": "Kurzhanteln",
      "cue": "Knie fast gestreckt lassen und die Hüfte nach hinten schieben, bis es hinten am Oberschenkel zieht. Rücken gerade, Hanteln nah am Bein. Nicht tiefer als die Dehnung erlaubt.",
      "rest": 150,
      "pattern": "hinge",
      "shares": {
        "hamstrings": 1.0,
        "glutes": 0.7,
        "abs": 0.2
      },
      "muscles": [
        "hamstrings",
        "glutes",
        "abs"
      ]
    },
    "bw": {
      "name": "Einbeiniges Kreuzheben (Standwaage)",
      "reps": "8–15 je Bein",
      "equip": "Ohne Gerät",
      "cue": "Auf einem Bein, das freie Bein wandert nach hinten, bis Rumpf und Bein eine Linie bilden. Hüfte gerade halten, nicht zur Seite kippen.",
      "rest": 150,
      "pattern": "hinge1",
      "shares": {
        "hamstrings": 1.0,
        "glutes": 0.75,
        "abs": 0.3
      },
      "muscles": [
        "hamstrings",
        "glutes",
        "abs"
      ]
    }
  },
  {
    "id": "split-squat",
    "group": "Beine",
    "weight": 10,
    "step": 2,
    "weightNote": "je Hand",
    "equip": "dumbbells",
    "db": {
      "name": "Split Squat",
      "reps": "8–12 je Bein",
      "equip": "Kurzhanteln",
      "cue": "Ein Bein weit vorn, das hintere Knie senkt sich Richtung Boden. Rumpf aufrecht, das Gewicht auf der ganzen vorderen Fußsohle. Hinteren Fuß erhöhen macht es schwerer.",
      "rest": 150,
      "pattern": "splitsquat",
      "shares": {
        "quads": 1.0,
        "glutes": 0.8,
        "hamstrings": 0.3,
        "abs": 0.25
      },
      "muscles": [
        "quads",
        "glutes",
        "hamstrings",
        "abs"
      ]
    },
    "bw": {
      "name": "Split Squat ohne Gewicht",
      "reps": "12–20 je Bein",
      "equip": "Ohne Gerät",
      "cue": "Gleiche Stellung ohne Gewicht, dafür langsam: drei Sekunden ablassen, unten kurz halten.",
      "rest": 150,
      "pattern": "splitsquat",
      "shares": {
        "quads": 1.0,
        "glutes": 0.8,
        "hamstrings": 0.3,
        "abs": 0.25
      },
      "muscles": [
        "quads",
        "glutes",
        "hamstrings",
        "abs"
      ]
    }
  },
  {
    "id": "haengendes-knieheben",
    "group": "Bauch",
    "weight": null,
    "step": null,
    "weightNote": null,
    "equip": null,
    "db": {
      "name": "Hängendes Knieheben",
      "reps": "8–15",
      "equip": "Klimmzugstange",
      "cue": "An der Stange hängen, Schultern aktiv nach unten ziehen. Knie anheben und das Becken am Ende einrollen – nicht schwingen, die letzten Grad machen die Arbeit.",
      "rest": 120,
      "pattern": "kneeraise",
      "shares": {
        "abs": 1.0
      },
      "muscles": [
        "abs"
      ]
    },
    "bw": {
      "name": "Hängendes Knieheben",
      "reps": "8–15",
      "equip": "Klimmzugstange",
      "cue": "An der Stange hängen, Schultern aktiv nach unten ziehen. Knie anheben und das Becken am Ende einrollen – nicht schwingen, die letzten Grad machen die Arbeit.",
      "rest": 120,
      "pattern": "kneeraise",
      "shares": {
        "abs": 1.0
      },
      "muscles": [
        "abs"
      ]
    }
  },
  {
    "id": "band-pull-apart",
    "group": "Schulter",
    "weight": null,
    "step": null,
    "weightNote": null,
    "equip": "band",
    "db": {
      "name": "Band-Pull-Apart",
      "reps": "12–20",
      "equip": "Loop-Band",
      "cue": "Arme vorn auf Schulterhöhe, Band gespannt. Nach außen ziehen, bis die Arme eine Linie bilden, Schulterblätter zusammen. Rumpf bleibt stehen, kein Schwung. Mit einem langen Band über der Klimmzugstange wird daraus ein Face Pull – zum Gesicht ziehen, Ellenbogen hoch; das ist die bessere Variante, wenn dein Band lang genug ist. Schwerer wird es mit dem nächststärkeren Band oder engerem Griff.",
      "rest": 120,
      "pattern": "pullapart",
      "shares": {
        "rearDelts": 1.0,
        "traps": 0.7
      },
      "muscles": [
        "rearDelts",
        "traps"
      ]
    },
    "bw": {
      "name": "Band-Pull-Apart",
      "reps": "12–20",
      "equip": "Loop-Band",
      "cue": "Arme vorn auf Schulterhöhe, Band gespannt. Nach außen ziehen, bis die Arme eine Linie bilden, Schulterblätter zusammen. Rumpf bleibt stehen, kein Schwung. Mit einem langen Band über der Klimmzugstange wird daraus ein Face Pull – zum Gesicht ziehen, Ellenbogen hoch; das ist die bessere Variante, wenn dein Band lang genug ist. Schwerer wird es mit dem nächststärkeren Band oder engerem Griff.",
      "rest": 120,
      "pattern": "pullapart",
      "shares": {
        "rearDelts": 1.0,
        "traps": 0.7
      },
      "muscles": [
        "rearDelts",
        "traps"
      ]
    }
  }
];

// Saetze je Muskelgruppe und Woche, auf die der Plan gerechnet ist.
export const TARGET = {"abs": 10, "biceps": 10, "calves": 4, "chest": 10, "delts": 10, "glutes": 8, "hamstrings": 6, "lats": 10, "quads": 6, "rearDelts": 10, "traps": 10.0, "triceps": 10};

// Gruppen ohne eigenes Ziel: ihr Wert faellt aus den uebrigen Gleichungen.
export const DERIVED = ["traps"];

// Erholung: Mindestabstand in Tagen, bis eine Gruppe wieder direkt drankommt,
// und ab welchem Anteil eine Uebung als direkt fuer die Gruppe gilt.
export const REST = {"days": 2, "direct": 0.5};

export const PLAN = [{"n":1,"date":"2026-08-24","ex":[{"id":"chin-ups","sets":3},{"id":"gewichtete-liegestuetze","sets":3},{"id":"sliding-leg-curl","sets":2},{"id":"band-pull-apart","sets":3},{"id":"liegende-trizepsstrecker","sets":3},{"id":"einbeiniges-stehendes-wadenheben","sets":2}]},{"n":2,"date":"2026-08-26","ex":[{"id":"fuesse-erhoehte-liegestuetze","sets":3},{"id":"chin-ups","sets":2},{"id":"goblet-squat","sets":2},{"id":"fersenerhoehter-goblet-squat","sets":2},{"id":"reverse-fly","sets":3},{"id":"sz-curls","sets":2},{"id":"wadenheben-gebeugtes-knie","sets":2}]},{"n":3,"date":"2026-08-28","ex":[{"id":"fuesse-erhoehte-liegestuetze","sets":2},{"id":"floor-press","sets":2},{"id":"sitzendes-schulterdruecken","sets":2},{"id":"goblet-squat","sets":2},{"id":"hip-thrust","sets":3},{"id":"sliding-leg-curl","sets":2},{"id":"sitzendes-seitheben","sets":3}]},{"n":4,"date":"2026-08-29","ex":[{"id":"einarmiges-kh-rudern","sets":3},{"id":"chin-ups","sets":2},{"id":"band-pull-apart","sets":2},{"id":"haengendes-knieheben","sets":3},{"id":"sz-curls","sets":2},{"id":"gewichtete-crunches","sets":3}]},{"n":5,"date":"2026-08-31","ex":[{"id":"chin-ups","sets":3},{"id":"floor-press","sets":3},{"id":"hip-thrust","sets":3},{"id":"sitzendes-seitheben","sets":2},{"id":"gewichtete-crunches","sets":3},{"id":"einbeiniges-stehendes-wadenheben","sets":2}]},{"n":6,"date":"2026-09-02","ex":[{"id":"fuesse-erhoehte-liegestuetze","sets":2},{"id":"chin-ups","sets":2},{"id":"gewichtete-liegestuetze","sets":3},{"id":"einbeiniger-sliding-leg-curl","sets":2},{"id":"band-pull-apart","sets":3},{"id":"haengendes-knieheben","sets":2},{"id":"sz-curls","sets":2}]},{"n":7,"date":"2026-09-04","ex":[{"id":"fuesse-erhoehte-liegestuetze","sets":2},{"id":"goblet-squat","sets":3},{"id":"rumaenisches-kreuzheben","sets":2},{"id":"fersenerhoehter-goblet-squat","sets":3},{"id":"sitzendes-seitheben","sets":3},{"id":"liegende-trizepsstrecker","sets":3}]},{"n":8,"date":"2026-09-05","ex":[{"id":"einarmiges-kh-rudern","sets":3},{"id":"chin-ups","sets":2},{"id":"band-pull-apart","sets":3},{"id":"reverse-fly","sets":2},{"id":"sz-curls","sets":2},{"id":"gewichtete-crunches","sets":2},{"id":"wadenheben-gebeugtes-knie","sets":2}]},{"n":9,"date":"2026-09-07","ex":[{"id":"einarmiges-kh-rudern","sets":3},{"id":"fuesse-erhoehte-liegestuetze","sets":2},{"id":"chin-ups","sets":2},{"id":"gewichtete-liegestuetze","sets":3},{"id":"rumaenisches-kreuzheben","sets":2},{"id":"fersenerhoehter-goblet-squat","sets":2},{"id":"sz-curls","sets":2}]},{"n":10,"date":"2026-09-09","ex":[{"id":"chin-ups","sets":3},{"id":"floor-press","sets":2},{"id":"split-squat","sets":2},{"id":"hip-thrust","sets":2},{"id":"band-pull-apart","sets":3},{"id":"haengendes-knieheben","sets":2},{"id":"gewichtete-crunches","sets":3}]},{"n":11,"date":"2026-09-11","ex":[{"id":"gewichtete-liegestuetze","sets":3},{"id":"sitzendes-schulterdruecken","sets":2},{"id":"goblet-squat","sets":2},{"id":"einbeiniger-sliding-leg-curl","sets":2},{"id":"sitzendes-seitheben","sets":3},{"id":"liegende-trizepsstrecker","sets":3}]},{"n":12,"date":"2026-09-12","ex":[{"id":"chin-ups","sets":2},{"id":"band-pull-apart","sets":3},{"id":"reverse-fly","sets":2},{"id":"haengendes-knieheben","sets":2},{"id":"sz-curls","sets":2},{"id":"einbeiniges-stehendes-wadenheben","sets":2},{"id":"wadenheben-gebeugtes-knie","sets":2}]},{"n":13,"date":"2026-09-14","ex":[{"id":"chin-ups","sets":3},{"id":"gewichtete-liegestuetze","sets":3},{"id":"floor-press","sets":2},{"id":"band-pull-apart","sets":3},{"id":"sitzendes-seitheben","sets":3},{"id":"sz-curls","sets":2}]},{"n":14,"date":"2026-09-16","ex":[{"id":"fuesse-erhoehte-liegestuetze","sets":3},{"id":"chin-ups","sets":2},{"id":"hip-thrust","sets":3},{"id":"reverse-fly","sets":3},{"id":"haengendes-knieheben","sets":2},{"id":"liegende-trizepsstrecker","sets":2},{"id":"wadenheben-gebeugtes-knie","sets":2}]},{"n":15,"date":"2026-09-18","ex":[{"id":"fuesse-erhoehte-liegestuetze","sets":2},{"id":"goblet-squat","sets":3},{"id":"rumaenisches-kreuzheben","sets":2},{"id":"fersenerhoehter-goblet-squat","sets":3},{"id":"einbeiniger-sliding-leg-curl","sets":2},{"id":"sitzendes-seitheben","sets":2},{"id":"liegende-trizepsstrecker","sets":2}]},{"n":16,"date":"2026-09-19","ex":[{"id":"einarmiges-kh-rudern","sets":3},{"id":"chin-ups","sets":2},{"id":"band-pull-apart","sets":2},{"id":"haengendes-knieheben","sets":3},{"id":"sz-curls","sets":2},{"id":"gewichtete-crunches","sets":2},{"id":"einbeiniges-stehendes-wadenheben","sets":2}]},{"n":17,"date":"2026-09-21","ex":[{"id":"chin-ups","sets":2},{"id":"sitzendes-schulterdruecken","sets":2},{"id":"rumaenisches-kreuzheben","sets":3},{"id":"band-pull-apart","sets":2},{"id":"reverse-fly","sets":3},{"id":"haengendes-knieheben","sets":2},{"id":"sz-curls","sets":2}]},{"n":18,"date":"2026-09-23","ex":[{"id":"fuesse-erhoehte-liegestuetze","sets":2},{"id":"chin-ups","sets":3},{"id":"gewichtete-liegestuetze","sets":3},{"id":"hip-thrust","sets":2},{"id":"band-pull-apart","sets":3},{"id":"liegende-trizepsstrecker","sets":3}]},{"n":19,"date":"2026-09-25","ex":[{"id":"fuesse-erhoehte-liegestuetze","sets":2},{"id":"floor-press","sets":3},{"id":"goblet-squat","sets":3},{"id":"fersenerhoehter-goblet-squat","sets":3},{"id":"einbeiniger-sliding-leg-curl","sets":2},{"id":"sitzendes-seitheben","sets":3}]},{"n":20,"date":"2026-09-26","ex":[{"id":"einarmiges-kh-rudern","sets":3},{"id":"chin-ups","sets":2},{"id":"haengendes-knieheben","sets":3},{"id":"sz-curls","sets":2},{"id":"gewichtete-crunches","sets":2},{"id":"einbeiniges-stehendes-wadenheben","sets":2},{"id":"wadenheben-gebeugtes-knie","sets":2}]},{"n":21,"date":"2026-09-28","ex":[{"id":"fuesse-erhoehte-liegestuetze","sets":2},{"id":"chin-ups","sets":2},{"id":"rumaenisches-kreuzheben","sets":2},{"id":"fersenerhoehter-goblet-squat","sets":2},{"id":"band-pull-apart","sets":3},{"id":"sitzendes-seitheben","sets":3},{"id":"sz-curls","sets":2}]},{"n":22,"date":"2026-09-30","ex":[{"id":"chin-ups","sets":3},{"id":"sitzendes-schulterdruecken","sets":2},{"id":"goblet-squat","sets":2},{"id":"einbeiniger-sliding-leg-curl","sets":2},{"id":"reverse-fly","sets":3},{"id":"haengendes-knieheben","sets":2},{"id":"sz-curls","sets":2}]},{"n":23,"date":"2026-10-02","ex":[{"id":"fuesse-erhoehte-liegestuetze","sets":3},{"id":"gewichtete-liegestuetze","sets":3},{"id":"floor-press","sets":2},{"id":"goblet-squat","sets":2},{"id":"hip-thrust","sets":3},{"id":"liegende-trizepsstrecker","sets":3}]},{"n":24,"date":"2026-10-03","ex":[{"id":"einarmiges-kh-rudern","sets":3},{"id":"chin-ups","sets":2},{"id":"band-pull-apart","sets":2},{"id":"haengendes-knieheben","sets":3},{"id":"gewichtete-crunches","sets":2},{"id":"einbeiniges-stehendes-wadenheben","sets":2},{"id":"wadenheben-gebeugtes-knie","sets":2}]},{"n":25,"date":"2026-10-05","ex":[{"id":"fuesse-erhoehte-liegestuetze","sets":2},{"id":"chin-ups","sets":3},{"id":"split-squat","sets":2},{"id":"rumaenisches-kreuzheben","sets":2},{"id":"reverse-fly","sets":2},{"id":"sitzendes-seitheben","sets":3},{"id":"gewichtete-crunches","sets":2}]},{"n":26,"date":"2026-10-07","ex":[{"id":"chin-ups","sets":2},{"id":"fersenerhoehter-goblet-squat","sets":2},{"id":"band-pull-apart","sets":3},{"id":"liegende-trizepsstrecker","sets":3},{"id":"sz-curls","sets":2},{"id":"gewichtete-crunches","sets":2},{"id":"wadenheben-gebeugtes-knie","sets":2}]},{"n":27,"date":"2026-10-09","ex":[{"id":"fuesse-erhoehte-liegestuetze","sets":2},{"id":"gewichtete-liegestuetze","sets":3},{"id":"floor-press","sets":3},{"id":"sitzendes-schulterdruecken","sets":2},{"id":"goblet-squat","sets":2},{"id":"rumaenisches-kreuzheben","sets":3}]},{"n":28,"date":"2026-10-10","ex":[{"id":"einarmiges-kh-rudern","sets":3},{"id":"chin-ups","sets":2},{"id":"band-pull-apart","sets":3},{"id":"haengendes-knieheben","sets":3},{"id":"sz-curls","sets":2},{"id":"einbeiniges-stehendes-wadenheben","sets":2}]},{"n":29,"date":"2026-10-12","ex":[{"id":"chin-ups","sets":2},{"id":"split-squat","sets":2},{"id":"einbeiniger-sliding-leg-curl","sets":2},{"id":"band-pull-apart","sets":3},{"id":"haengendes-knieheben","sets":2},{"id":"liegende-trizepsstrecker","sets":3},{"id":"sz-curls","sets":2}]},{"n":30,"date":"2026-10-14","ex":[{"id":"einarmiges-kh-rudern","sets":3},{"id":"fuesse-erhoehte-liegestuetze","sets":2},{"id":"chin-ups","sets":2},{"id":"goblet-squat","sets":2},{"id":"rumaenisches-kreuzheben","sets":2},{"id":"hip-thrust","sets":2},{"id":"haengendes-knieheben","sets":3}]},{"n":31,"date":"2026-10-16","ex":[{"id":"fuesse-erhoehte-liegestuetze","sets":2},{"id":"gewichtete-liegestuetze","sets":3},{"id":"floor-press","sets":3},{"id":"sitzendes-schulterdruecken","sets":2},{"id":"fersenerhoehter-goblet-squat","sets":2},{"id":"sitzendes-seitheben","sets":3}]},{"n":32,"date":"2026-10-17","ex":[{"id":"chin-ups","sets":3},{"id":"band-pull-apart","sets":2},{"id":"reverse-fly","sets":2},{"id":"sz-curls","sets":2},{"id":"gewichtete-crunches","sets":2},{"id":"einbeiniges-stehendes-wadenheben","sets":2},{"id":"wadenheben-gebeugtes-knie","sets":2}]},{"n":33,"date":"2026-10-19","ex":[{"id":"fuesse-erhoehte-liegestuetze","sets":2},{"id":"chin-ups","sets":2},{"id":"gewichtete-liegestuetze","sets":3},{"id":"sliding-leg-curl","sets":2},{"id":"band-pull-apart","sets":3},{"id":"sz-curls","sets":2},{"id":"wadenheben-gebeugtes-knie","sets":2}]},{"n":34,"date":"2026-10-21","ex":[{"id":"chin-ups","sets":3},{"id":"floor-press","sets":3},{"id":"fersenerhoehter-goblet-squat","sets":3},{"id":"sitzendes-seitheben","sets":2},{"id":"gewichtete-crunches","sets":3},{"id":"einbeiniges-stehendes-wadenheben","sets":2}]},{"n":35,"date":"2026-10-23","ex":[{"id":"fuesse-erhoehte-liegestuetze","sets":2},{"id":"goblet-squat","sets":3},{"id":"hip-thrust","sets":2},{"id":"einbeiniger-sliding-leg-curl","sets":3},{"id":"sitzendes-seitheben","sets":3},{"id":"liegende-trizepsstrecker","sets":3}]},{"n":36,"date":"2026-10-24","ex":[{"id":"einarmiges-kh-rudern","sets":3},{"id":"chin-ups","sets":2},{"id":"band-pull-apart","sets":3},{"id":"reverse-fly","sets":2},{"id":"haengendes-knieheben","sets":2},{"id":"sz-curls","sets":2},{"id":"gewichtete-crunches","sets":2}]},{"n":37,"date":"2026-10-26","ex":[{"id":"chin-ups","sets":2},{"id":"gewichtete-liegestuetze","sets":2},{"id":"hip-thrust","sets":3},{"id":"sitzendes-seitheben","sets":3},{"id":"liegende-trizepsstrecker","sets":3},{"id":"sz-curls","sets":2},{"id":"einbeiniges-stehendes-wadenheben","sets":2}]},{"n":38,"date":"2026-10-28","ex":[{"id":"fuesse-erhoehte-liegestuetze","sets":3},{"id":"chin-ups","sets":3},{"id":"fersenerhoehter-goblet-squat","sets":3},{"id":"einbeiniger-sliding-leg-curl","sets":2},{"id":"band-pull-apart","sets":2},{"id":"haengendes-knieheben","sets":3},{"id":"wadenheben-gebeugtes-knie","sets":2}]},{"n":39,"date":"2026-10-30","ex":[{"id":"gewichtete-liegestuetze","sets":2},{"id":"floor-press","sets":3},{"id":"goblet-squat","sets":3},{"id":"einbeiniger-sliding-leg-curl","sets":2},{"id":"sitzendes-seitheben","sets":3}]},{"n":40,"date":"2026-10-31","ex":[{"id":"einarmiges-kh-rudern","sets":3},{"id":"chin-ups","sets":2},{"id":"band-pull-apart","sets":3},{"id":"reverse-fly","sets":3},{"id":"sz-curls","sets":2},{"id":"gewichtete-crunches","sets":3}]},{"n":41,"date":"2026-11-02","ex":[{"id":"chin-ups","sets":2},{"id":"floor-press","sets":3},{"id":"rumaenisches-kreuzheben","sets":2},{"id":"sliding-leg-curl","sets":2},{"id":"reverse-fly","sets":2},{"id":"sz-curls","sets":2},{"id":"gewichtete-crunches","sets":2}]},{"n":42,"date":"2026-11-04","ex":[{"id":"fuesse-erhoehte-liegestuetze","sets":2},{"id":"chin-ups","sets":2},{"id":"hip-thrust","sets":3},{"id":"reverse-fly","sets":3},{"id":"sitzendes-seitheben","sets":3},{"id":"haengendes-knieheben","sets":2},{"id":"einbeiniges-stehendes-wadenheben","sets":2}]},{"n":43,"date":"2026-11-06","ex":[{"id":"fuesse-erhoehte-liegestuetze","sets":2},{"id":"gewichtete-liegestuetze","sets":3},{"id":"sitzendes-schulterdruecken","sets":2},{"id":"goblet-squat","sets":3},{"id":"fersenerhoehter-goblet-squat","sets":3},{"id":"liegende-trizepsstrecker","sets":3}]},{"n":44,"date":"2026-11-07","ex":[{"id":"einarmiges-kh-rudern","sets":3},{"id":"chin-ups","sets":3},{"id":"band-pull-apart","sets":3},{"id":"sz-curls","sets":2},{"id":"gewichtete-crunches","sets":3},{"id":"wadenheben-gebeugtes-knie","sets":2}]},{"n":45,"date":"2026-11-09","ex":[{"id":"fuesse-erhoehte-liegestuetze","sets":2},{"id":"chin-ups","sets":2},{"id":"split-squat","sets":2},{"id":"band-pull-apart","sets":2},{"id":"liegende-trizepsstrecker","sets":3},{"id":"sz-curls","sets":2},{"id":"gewichtete-crunches","sets":3}]},{"n":46,"date":"2026-11-11","ex":[{"id":"chin-ups","sets":2},{"id":"floor-press","sets":3},{"id":"goblet-squat","sets":2},{"id":"hip-thrust","sets":2},{"id":"haengendes-knieheben","sets":2},{"id":"gewichtete-crunches","sets":3},{"id":"einbeiniges-stehendes-wadenheben","sets":2}]},{"n":47,"date":"2026-11-13","ex":[{"id":"fuesse-erhoehte-liegestuetze","sets":2},{"id":"gewichtete-liegestuetze","sets":3},{"id":"sitzendes-schulterdruecken","sets":2},{"id":"goblet-squat","sets":2},{"id":"hip-thrust","sets":2},{"id":"einbeiniger-sliding-leg-curl","sets":2},{"id":"sitzendes-seitheben","sets":3}]},{"n":48,"date":"2026-11-14","ex":[{"id":"einarmiges-kh-rudern","sets":3},{"id":"chin-ups","sets":3},{"id":"band-pull-apart","sets":3},{"id":"reverse-fly","sets":3},{"id":"sz-curls","sets":2},{"id":"wadenheben-gebeugtes-knie","sets":2}]},{"n":49,"date":"2026-11-16","ex":[{"id":"fuesse-erhoehte-liegestuetze","sets":2},{"id":"chin-ups","sets":3},{"id":"gewichtete-liegestuetze","sets":3},{"id":"split-squat","sets":2},{"id":"reverse-fly","sets":3},{"id":"liegende-trizepsstrecker","sets":2},{"id":"gewichtete-crunches","sets":2}]},{"n":50,"date":"2026-11-18","ex":[{"id":"chin-ups","sets":2},{"id":"floor-press","sets":3},{"id":"sliding-leg-curl","sets":2},{"id":"band-pull-apart","sets":3},{"id":"sitzendes-seitheben","sets":3},{"id":"haengendes-knieheben","sets":2},{"id":"sz-curls","sets":2}]},{"n":51,"date":"2026-11-20","ex":[{"id":"fuesse-erhoehte-liegestuetze","sets":2},{"id":"goblet-squat","sets":2},{"id":"hip-thrust","sets":3},{"id":"fersenerhoehter-goblet-squat","sets":2},{"id":"einbeiniger-sliding-leg-curl","sets":2},{"id":"sitzendes-seitheben","sets":3},{"id":"liegende-trizepsstrecker","sets":2}]},{"n":52,"date":"2026-11-21","ex":[{"id":"einarmiges-kh-rudern","sets":3},{"id":"chin-ups","sets":2},{"id":"band-pull-apart","sets":2},{"id":"sz-curls","sets":2},{"id":"gewichtete-crunches","sets":3},{"id":"einbeiniges-stehendes-wadenheben","sets":2},{"id":"wadenheben-gebeugtes-knie","sets":2}]},{"n":53,"date":"2026-11-23","ex":[{"id":"fuesse-erhoehte-liegestuetze","sets":2},{"id":"chin-ups","sets":3},{"id":"split-squat","sets":2},{"id":"einbeiniger-sliding-leg-curl","sets":2},{"id":"band-pull-apart","sets":2},{"id":"liegende-trizepsstrecker","sets":3},{"id":"sz-curls","sets":2}]},{"n":54,"date":"2026-11-25","ex":[{"id":"einarmiges-kh-rudern","sets":3},{"id":"chin-ups","sets":2},{"id":"sitzendes-schulterdruecken","sets":2},{"id":"goblet-squat","sets":2},{"id":"sliding-leg-curl","sets":2},{"id":"band-pull-apart","sets":3},{"id":"gewichtete-crunches","sets":2}]},{"n":55,"date":"2026-11-27","ex":[{"id":"fuesse-erhoehte-liegestuetze","sets":2},{"id":"gewichtete-liegestuetze","sets":3},{"id":"floor-press","sets":3},{"id":"hip-thrust","sets":2},{"id":"fersenerhoehter-goblet-squat","sets":2},{"id":"sitzendes-seitheben","sets":3}]},{"n":56,"date":"2026-11-28","ex":[{"id":"chin-ups","sets":2},{"id":"reverse-fly","sets":3},{"id":"haengendes-knieheben","sets":2},{"id":"sz-curls","sets":2},{"id":"gewichtete-crunches","sets":3},{"id":"einbeiniges-stehendes-wadenheben","sets":2},{"id":"wadenheben-gebeugtes-knie","sets":2}]},{"n":57,"date":"2026-11-30","ex":[{"id":"fuesse-erhoehte-liegestuetze","sets":2},{"id":"chin-ups","sets":2},{"id":"fersenerhoehter-goblet-squat","sets":2},{"id":"band-pull-apart","sets":2},{"id":"sitzendes-seitheben","sets":3},{"id":"gewichtete-crunches","sets":2},{"id":"wadenheben-gebeugtes-knie","sets":2}]},{"n":58,"date":"2026-12-02","ex":[{"id":"chin-ups","sets":2},{"id":"gewichtete-liegestuetze","sets":3},{"id":"split-squat","sets":2},{"id":"band-pull-apart","sets":3},{"id":"liegende-trizepsstrecker","sets":3},{"id":"sz-curls","sets":2},{"id":"einbeiniges-stehendes-wadenheben","sets":2}]},{"n":59,"date":"2026-12-04","ex":[{"id":"fuesse-erhoehte-liegestuetze","sets":2},{"id":"floor-press","sets":3},{"id":"sitzendes-schulterdruecken","sets":2},{"id":"goblet-squat","sets":2},{"id":"hip-thrust","sets":3},{"id":"sliding-leg-curl","sets":3}]},{"n":60,"date":"2026-12-05","ex":[{"id":"einarmiges-kh-rudern","sets":3},{"id":"chin-ups","sets":3},{"id":"reverse-fly","sets":2},{"id":"haengendes-knieheben","sets":3},{"id":"sz-curls","sets":2},{"id":"gewichtete-crunches","sets":2}]},{"n":61,"date":"2026-12-07","ex":[{"id":"chin-ups","sets":3},{"id":"gewichtete-liegestuetze","sets":3},{"id":"sitzendes-schulterdruecken","sets":2},{"id":"goblet-squat","sets":2},{"id":"reverse-fly","sets":3},{"id":"gewichtete-crunches","sets":2}]},{"n":62,"date":"2026-12-09","ex":[{"id":"einarmiges-kh-rudern","sets":3},{"id":"fuesse-erhoehte-liegestuetze","sets":2},{"id":"chin-ups","sets":2},{"id":"floor-press","sets":2},{"id":"rumaenisches-kreuzheben","sets":3},{"id":"band-pull-apart","sets":2},{"id":"haengendes-knieheben","sets":2}]},{"n":63,"date":"2026-12-11","ex":[{"id":"fuesse-erhoehte-liegestuetze","sets":3},{"id":"split-squat","sets":2},{"id":"fersenerhoehter-goblet-squat","sets":2},{"id":"einbeiniger-sliding-leg-curl","sets":3},{"id":"sitzendes-seitheben","sets":3},{"id":"liegende-trizepsstrecker","sets":3}]},{"n":64,"date":"2026-12-12","ex":[{"id":"chin-ups","sets":2},{"id":"band-pull-apart","sets":3},{"id":"sz-curls","sets":3},{"id":"gewichtete-crunches","sets":3},{"id":"einbeiniges-stehendes-wadenheben","sets":2},{"id":"wadenheben-gebeugtes-knie","sets":2}]},{"n":65,"date":"2026-12-14","ex":[{"id":"chin-ups","sets":2},{"id":"hip-thrust","sets":2},{"id":"reverse-fly","sets":3},{"id":"haengendes-knieheben","sets":3},{"id":"liegende-trizepsstrecker","sets":3},{"id":"sz-curls","sets":2}]},{"n":66,"date":"2026-12-16","ex":[{"id":"einarmiges-kh-rudern","sets":3},{"id":"fuesse-erhoehte-liegestuetze","sets":2},{"id":"chin-ups","sets":3},{"id":"goblet-squat","sets":2},{"id":"rumaenisches-kreuzheben","sets":2},{"id":"einbeiniger-sliding-leg-curl","sets":2},{"id":"band-pull-apart","sets":2}]},{"n":67,"date":"2026-12-18","ex":[{"id":"fuesse-erhoehte-liegestuetze","sets":2},{"id":"gewichtete-liegestuetze","sets":3},{"id":"floor-press","sets":3},{"id":"sitzendes-schulterdruecken","sets":2},{"id":"split-squat","sets":2},{"id":"fersenerhoehter-goblet-squat","sets":2},{"id":"sitzendes-seitheben","sets":3}]},{"n":68,"date":"2026-12-19","ex":[{"id":"chin-ups","sets":2},{"id":"band-pull-apart","sets":3},{"id":"haengendes-knieheben","sets":2},{"id":"sz-curls","sets":2},{"id":"gewichtete-crunches","sets":2},{"id":"einbeiniges-stehendes-wadenheben","sets":2},{"id":"wadenheben-gebeugtes-knie","sets":2}]},{"n":69,"date":"2026-12-21","ex":[{"id":"chin-ups","sets":2},{"id":"gewichtete-liegestuetze","sets":2},{"id":"sliding-leg-curl","sets":2},{"id":"reverse-fly","sets":3},{"id":"sitzendes-seitheben","sets":3},{"id":"sz-curls","sets":2},{"id":"einbeiniges-stehendes-wadenheben","sets":2}]},{"n":70,"date":"2026-12-23","ex":[{"id":"chin-ups","sets":3},{"id":"floor-press","sets":3},{"id":"goblet-squat","sets":2},{"id":"hip-thrust","sets":2},{"id":"band-pull-apart","sets":3},{"id":"haengendes-knieheben","sets":2}]},{"n":71,"date":"2026-12-25","ex":[{"id":"fuesse-erhoehte-liegestuetze","sets":3},{"id":"gewichtete-liegestuetze","sets":2},{"id":"split-squat","sets":2},{"id":"fersenerhoehter-goblet-squat","sets":2},{"id":"einbeiniger-sliding-leg-curl","sets":2},{"id":"sitzendes-seitheben","sets":3},{"id":"liegende-trizepsstrecker","sets":3}]},{"n":72,"date":"2026-12-26","ex":[{"id":"einarmiges-kh-rudern","sets":3},{"id":"chin-ups","sets":2},{"id":"band-pull-apart","sets":2},{"id":"haengendes-knieheben","sets":3},{"id":"sz-curls","sets":2},{"id":"gewichtete-crunches","sets":2},{"id":"wadenheben-gebeugtes-knie","sets":2}]},{"n":73,"date":"2026-12-28","ex":[{"id":"fuesse-erhoehte-liegestuetze","sets":3},{"id":"chin-ups","sets":2},{"id":"split-squat","sets":2},{"id":"hip-thrust","sets":2},{"id":"band-pull-apart","sets":3},{"id":"haengendes-knieheben","sets":2},{"id":"sz-curls","sets":2}]},{"n":74,"date":"2026-12-30","ex":[{"id":"chin-ups","sets":3},{"id":"floor-press","sets":2},{"id":"sliding-leg-curl","sets":2},{"id":"reverse-fly","sets":3},{"id":"liegende-trizepsstrecker","sets":3},{"id":"sz-curls","sets":2}]},{"n":75,"date":"2027-01-01","ex":[{"id":"fuesse-erhoehte-liegestuetze","sets":2},{"id":"gewichtete-liegestuetze","sets":3},{"id":"sitzendes-schulterdruecken","sets":2},{"id":"goblet-squat","sets":2},{"id":"fersenerhoehter-goblet-squat","sets":2},{"id":"einbeiniger-sliding-leg-curl","sets":2},{"id":"sitzendes-seitheben","sets":3}]},{"n":76,"date":"2027-01-02","ex":[{"id":"einarmiges-kh-rudern","sets":3},{"id":"chin-ups","sets":2},{"id":"reverse-fly","sets":2},{"id":"haengendes-knieheben","sets":3},{"id":"gewichtete-crunches","sets":2},{"id":"einbeiniges-stehendes-wadenheben","sets":2},{"id":"wadenheben-gebeugtes-knie","sets":2}]},{"n":77,"date":"2027-01-04","ex":[{"id":"chin-ups","sets":2},{"id":"floor-press","sets":2},{"id":"split-squat","sets":2},{"id":"sliding-leg-curl","sets":2},{"id":"reverse-fly","sets":3},{"id":"liegende-trizepsstrecker","sets":3},{"id":"sz-curls","sets":2}]},{"n":78,"date":"2027-01-06","ex":[{"id":"fuesse-erhoehte-liegestuetze","sets":3},{"id":"chin-ups","sets":2},{"id":"sitzendes-schulterdruecken","sets":2},{"id":"haengendes-knieheben","sets":2},{"id":"sz-curls","sets":2},{"id":"gewichtete-crunches","sets":3},{"id":"einbeiniges-stehendes-wadenheben","sets":2}]},{"n":79,"date":"2027-01-08","ex":[{"id":"fuesse-erhoehte-liegestuetze","sets":2},{"id":"gewichtete-liegestuetze","sets":3},{"id":"goblet-squat","sets":2},{"id":"rumaenisches-kreuzheben","sets":2},{"id":"hip-thrust","sets":2},{"id":"fersenerhoehter-goblet-squat","sets":2},{"id":"sitzendes-seitheben","sets":3}]},{"n":80,"date":"2027-01-09","ex":[{"id":"einarmiges-kh-rudern","sets":3},{"id":"chin-ups","sets":3},{"id":"band-pull-apart","sets":3},{"id":"reverse-fly","sets":2},{"id":"haengendes-knieheben","sets":2},{"id":"wadenheben-gebeugtes-knie","sets":2}]}];

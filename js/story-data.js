/* ==========================================================================
   1142949 HW06 — 京都百鬼夜行：陰陽鎮魂錄
   File: js/story-data.js
   Complete Anime Visual Novel Script, Branching Choices, 3 Boss Personas,
   Yokai Codex Database, and Onmyoji Rank & Achievement System
   ========================================================================== */

(function () {
  "use strict";

  const CHARACTERS = {
    ren: {
      id: "ren",
      name: "神樂坂 蓮",
      title: "晴明傳人・首席青年陰陽師",
      portrait: "./assets/char_ren.jpg",
      sealId: "#seal-ren",
      sealName: "晴明五芒星熾陽御守",
      voiceFreq: 310,
      themeColor: "#d63826"
    },
    tamamo: {
      id: "tamamo",
      name: "玉藻前",
      title: "伏見千本鳥居・九尾白面金毛妖狐",
      portrait: "./assets/char_tamamo.jpg",
      sealId: "#seal-tamamo",
      sealName: "九尾蒼炎妖狐印",
      voiceFreq: 470,
      themeColor: "#16a89a",
      counterCallouts: ["破！", "封！", "惑！"],
      cutinCounterTitle: "九尾妖術・蒼炎落雷破陣！",
      cutinVeinTitle: "傾國妖脈・蒼狐千幻貫通！",
      cutinFinaleTitle: "百鬼終章・九尾天狐滅界斬！"
    },
    ibaraki: {
      id: "ibaraki",
      name: "茨木童子",
      title: "羅生門鬼王・紅蓮斷嶽羅剎",
      portrait: "./assets/char_ibaraki.jpg",
      sealId: "#seal-ibaraki",
      sealName: "羅生門紅蓮鬼王印",
      voiceFreq: 210,
      themeColor: "#d95b26",
      counterCallouts: ["斬！", "碎！", "斷！"],
      cutinCounterTitle: "羅生鬼道・黑雷斷脈一閃！",
      cutinVeinTitle: "鬼王咆哮・紅蓮荒神貫脈！",
      cutinFinaleTitle: "修羅奧義・羅生門萬鬼崩嶽斬！"
    },
    tengu: {
      id: "tengu",
      name: "崇德嵐羽",
      title: "鞍馬山之主・銀翼神風大天狗",
      portrait: "./assets/char_tengu.jpg",
      sealId: "#seal-tengu",
      sealName: "鞍馬天狗風神印",
      voiceFreq: 265,
      themeColor: "#19a873",
      counterCallouts: ["嵐！", "絕！", "封！"],
      cutinCounterTitle: "鞍馬秘劍・神風羽嵐截脈！",
      cutinVeinTitle: "天狗神通・八方風門貫通！",
      cutinFinaleTitle: "天道終焉・迦樓羅萬羽裂空斬！"
    },
    narrator: {
      id: "narrator",
      name: "百鬼繪卷旁白",
      title: "京都陰陽寮秘錄",
      portrait: null,
      voiceFreq: 360,
      themeColor: "#e0ad46"
    }
  };

  /* --------------------------------------------------------------------------
     Prologue Script — 序章《血月升起・丑時三刻的京都》
     -------------------------------------------------------------------------- */
  const PROLOGUE_SCRIPT = {
    id: "prologue",
    bannerTitle: "序章 · 丑時三刻的血月百鬼夜行",
    bgStage: "fushimi",
    bgm: "moonlight",
    lines: [
      {
        speaker: "narrator",
        emotion: "【京都異變】",
        left: null,
        right: null,
        text: "平安京千年以降，京都地底由『八卦九宮大結界』鎮守靈脈。然而今夜丑時三刻，赤金血月高懸天際，三處鬼門封印同時震裂——"
      },
      {
        speaker: "ren",
        emotion: "【凝神戒備】",
        left: "ren",
        right: null,
        text: "「伏見稻荷的千本鳥居、九條羅生門舊址、還有北方鞍馬山巔……三股足以傾覆王城的妖氣同時甦醒了。」"
      },
      {
        speaker: "ren",
        emotion: "【展開五芒星符】",
        left: "ren",
        right: null,
        text: "「師父臨行前曾叮囑：上古大妖與天地靈脈共生，強行誅滅只會引爆地脈。唯有在『九宮九印盡數落定』之時，以分毫不差的『陰陽相衡』之局將其鎮封！」"
      },
      {
        speaker: "tamamo",
        emotion: "【魅惑輕笑】",
        left: "ren",
        right: "tamamo",
        text: "「呵呵呵……這麼年輕的陰陽師，也敢獨自踏入妾身的千本鳥居？你手中那枚晴明桔梗印，倒是讓妾身懷念起千年前的舊人呢。」"
      },
      {
        speaker: "ren",
        emotion: "【凜然拔扇】",
        left: "ren",
        right: "tamamo",
        text: "「白面金毛九尾狐・玉藻前！今夜我神樂坂 蓮奉陰陽寮之命，以九宮五枚熾陽御守與妳對弈鎮魂！」"
      },
      {
        speaker: "tamamo",
        emotion: "【狐火繚繞】",
        left: "ren",
        right: "tamamo",
        choices: [
          {
            label: "「九宮落滿九印之時，我必以陰陽相衡鎖住妳的妖脈！」（正氣凜然）",
            replySpeaker: "tamamo",
            replyEmotion: "【饒有興致】",
            replyText: "「好膽識！妾身身為後手執四枚蒼炎狐印，早已推演盡九手萬千變化——只要你露出一絲破綻，伏見靈脈便歸百鬼所有！」"
          },
          {
            label: "「聽聞玉藻前算無遺策，今夜便請指教千年妖狐的棋藝！」（以禮相待）",
            replySpeaker: "tamamo",
            replyEmotion: "【掩袖微笑】",
            replyText: "「嘴倒是挺甜～不過棋盤之上可沒有憐香惜玉，待九印全部落下才算終局，可別在中途就被妾身截斷先機囉！」"
          }
        ],
        text: "「想封印妾身？那便看看你這五枚五芒星印，能否撐過妾身後手不敗的九宮殺陣！」"
      }
    ]
  };

  /* --------------------------------------------------------------------------
     3 Full Anime Campaign Chapters (Intro + Seal Clear Epilogue + Defeat Scene)
     -------------------------------------------------------------------------- */
  const CHAPTERS = [
    {
      index: 0,
      id: "ch1_fushimi",
      chapterTag: "第一章",
      title: "伏見千本鳥居・九尾之約",
      location: "京都・伏見稻荷千本鳥居",
      stageKey: "fushimi",
      ruleMode: "standard",
      bgmBattle: "shrine_duel",
      bgmClimax: "yokai_storm",
      bossId: "tamamo",
      introScript: {
        id: "ch1_intro",
        bannerTitle: "第一章 · 伏見千本鳥居：九尾妖狐・玉藻前",
        bgStage: "fushimi",
        bgm: "moonlight",
        lines: [
          {
            speaker: "narrator",
            emotion: "【朱紅鳥居】",
            left: "ren",
            right: "tamamo",
            text: "夜櫻隨風飄落於石燈籠之間，幽藍狐火沿著千本鳥居蜿蜒而上，化為一座發光的九宮靈脈棋盤。"
          },
          {
            speaker: "tamamo",
            emotion: "【妖瞳閃爍】",
            left: "ren",
            right: "tamamo",
            text: "「規則很簡單，小陰陽師。九宮共九格，你先手落五印，妾身後手落四印——中途縱有人連成三印貫通靈脈，戰局亦絕不停歇，必須等全部九顆靈印落下才算終局！」"
          },
          {
            speaker: "ren",
            emotion: "【冷靜推演】",
            left: "ren",
            right: "tamamo",
            text: "「九印全落才結算……意味著即便中途奪下一脈，若大意讓對方連成雙脈或搶走『奪脈先機』，終局仍會敗北。每一步都必須算到第九手！」"
          },
          {
            speaker: "tamamo",
            emotion: "【展開狐尾】",
            left: "ren",
            right: "tamamo",
            text: "「正是如此！若你能與後手不敗的妾身戰成『陰陽相衡（平手）』，妾身便承認你的器量，收斂伏見妖氣並為你指引羅生門的方向。請落第一印吧！」"
          }
        ]
      },
      outroSealScript: {
        id: "ch1_seal",
        bannerTitle: "第一章鎮魂達成 · 狐火歸寂與羅生門之影",
        bgStage: "fushimi",
        bgm: "eternal_seal",
        lines: [
          {
            speaker: "narrator",
            emotion: "【陰陽相衡】",
            left: "ren",
            right: "tamamo",
            text: "第九枚晴明御守穩穩鎮入宮格，赤金咒光與蒼青狐火在九宮陣心交織成完美的太極圓環，狂暴的地脈瞬間平息！"
          },
          {
            speaker: "tamamo",
            emotion: "【撫扇讚嘆】",
            left: "ren",
            right: "tamamo",
            text: "「精彩！九印落盡竟沒有給妾身留下一絲破綻……這份滴水不漏的定力，確有當年安倍晴明的風範。」"
          },
          {
            speaker: "ren",
            emotion: "【收扇行禮】",
            left: "ren",
            right: "tamamo",
            text: "「承讓了，玉藻前。伏見靈脈既已歸於平衡，接下來我必須趕往九條羅生門。」"
          },
          {
            speaker: "tamamo",
            emotion: "【神色微凝】",
            left: "ren",
            right: "tamamo",
            text: "「當心了，小陰陽師。盤踞羅生門的鬼王『茨木童子』喚醒了地底『荒神龍穴』——經過龍穴的連線將爆發雙倍靈脈之力，可比妾身兇險得多呢！」"
          }
        ]
      },
      outroDefeatScript: {
        id: "ch1_defeat",
        bannerTitle: "結界失守 · 蒼炎吞噬九宮",
        bgStage: "fushimi",
        bgm: "moonlight",
        lines: [
          {
            speaker: "tamamo",
            emotion: "【得意輕笑】",
            left: "ren",
            right: "tamamo",
            text: "「呵呵呵，九印落定，靈脈歸妾身所有！心急搶攻卻忘了第九手的後患，這可是陰陽師的大忌喔。」"
          },
          {
            speaker: "ren",
            emotion: "【咬牙重整】",
            left: "ren",
            right: "tamamo",
            text: "「可惡，在中盤被奪走了關鍵靈脈嗎……幸好式神結界尚存，開啟『陰陽天眼』重新審視九手因果，再戰一局！」"
          }
        ]
      },
      banter: {
        opening: "「丑時已至，陰陽師。待九宮九印盡數落下，看誰能掌控伏見靈脈！」",
        normal: [
          "「此處靈脈，便由妾身的蒼炎狐印鎮下了。」",
          "「步步為營？可惜九宮氣數仍在妾身掌中。」",
          "「離九印滿盤尚有數合，千萬別露出破綻喔～」",
          "「呵呵，這一步棋意雖妙，卻還困不住九尾妖火。」"
        ],
        counter: [
          "「破！想在此處連成三印？妾身早一步截斷天機了！」",
          "「封鎖！晴明傳人的結界，可瞞不過九尾的妖瞳！」",
          "「蒼炎落雷！這一線靈脈，妾身收下了！」"
        ],
        midVeinHuman: "「哦？竟先貫通一道靈脈……但九印未滿，看妾身在剩餘宮格反撲！」",
        midVeinAI: "「蒼炎貫脈！妾身已奪下靈脈先機，剩餘宮格你如何回天？」",
        finaleWin: "「九印落盡，百鬼夜行！今夜伏見靈脈歸妾身統領了，呵呵呵！」",
        finaleDraw: "「九宮滿陣，陰陽相衡……閣下算無遺策，伏見結界便依約平息吧！」"
      }
    },

    {
      index: 1,
      id: "ch2_rashomon",
      chapterTag: "第二章",
      title: "羅生鬼門・荒神龍穴戰",
      location: "京都・九條羅生門雷火廢墟",
      stageKey: "rashomon",
      ruleMode: "dragon",
      bgmBattle: "shrine_duel",
      bgmClimax: "yokai_storm",
      bossId: "ibaraki",
      introScript: {
        id: "ch2_intro",
        bannerTitle: "第二章 · 羅生鬼門：紅蓮鬼王・茨木童子",
        bgStage: "rashomon",
        bgm: "shrine_duel",
        lines: [
          {
            speaker: "narrator",
            emotion: "【雷鳴暴雨】",
            left: "ren",
            right: "ibaraki",
            text: "暴雨傾盆的羅生門斷橋上，赤紅與青電撕裂夜空。獨角鬼王手按妖刀立於石門之下，腳下九宮格中有一宮正噴湧著狂暴的金紅龍脈！"
          },
          {
            speaker: "ibaraki",
            emotion: "【戰意沸騰】",
            left: "ren",
            right: "ibaraki",
            text: "「哈哈哈！能從玉藻前那隻老狐狸手下全身而退，你就是陰陽寮派來的神樂坂 蓮嗎？正好拿你試試本大爺的鬼王印！」"
          },
          {
            speaker: "ren",
            emotion: "【注視龍穴】",
            left: "ren",
            right: "ibaraki",
            text: "「好霸道的妖雷……九宮之中竟然甦醒了一處『荒神龍穴（龍穴×2）』！只要三印連線經過龍穴，一線就能爆發兩道靈脈的威力！」"
          },
          {
            speaker: "ibaraki",
            emotion: "【拔刀指向】",
            left: "ren",
            right: "ibaraki",
            choices: [
              {
                label: "「越是狂暴的龍脈，越要以九印滿盤的鐵壁陣勢將其鎮壓！」",
                replySpeaker: "ibaraki",
                replyEmotion: "【狂傲大笑】",
                replyText: "「痛快！本大爺最討厭畏首畏尾之輩！九顆靈印落滿之前誰也不准退，放馬過來吧！」"
              },
              {
                label: "「茨木童子，小心別反被荒神龍穴的因果困住了自己的刀路！」",
                replySpeaker: "ibaraki",
                replyEmotion: "【金瞳燃火】",
                replyText: "「哼，本大爺的羅生鬼道早已算盡龍穴生剋！接招吧，陰陽師！」"
              }
            ],
            text: "「聽好了！這羅生門戰場必須戰至第九印落下才見生死——看是你的五芒星守得住龍穴，還是本大爺一刀斬碎你的結界！」"
          }
        ]
      },
      outroSealScript: {
        id: "ch2_seal",
        bannerTitle: "第二章鎮魂達成 · 鬼王收刀與鞍馬天風",
        bgStage: "rashomon",
        bgm: "eternal_seal",
        lines: [
          {
            speaker: "narrator",
            emotion: "【雷雲散去】",
            left: "ren",
            right: "ibaraki",
            text: "隨著第九印重重砸入羅生門石盤，沸騰的荒神龍穴化作溫潤金光融入地脈，漫天雷火驟然止歇。"
          },
          {
            speaker: "ibaraki",
            emotion: "【收刀入鞘】",
            left: "ren",
            right: "ibaraki",
            text: "「哼……連雙倍威力的荒神龍穴都沒能撕開你的防線，九印落盡依然與本大爺戰成平分秋色。神樂坂 蓮，本大爺記住你的名字了！」"
          },
          {
            speaker: "ren",
            emotion: "【吐氣收印】",
            left: "ren",
            right: "ibaraki",
            text: "「好險……只要一步算錯龍穴的交叉線就會被瞬間逆轉。如今只剩最後一處鬼門——鞍馬山巔了！」"
          },
          {
            speaker: "ibaraki",
            emotion: "【仰望北山】",
            left: "ren",
            right: "ibaraki",
            text: "「鞍馬山那位『大天狗・崇德嵐羽』掌控著南北或東西成對開啟的『雙重風門』，那傢伙才是百鬼夜行真正的軍師。別輸給他了，陰陽師！」"
          }
        ]
      },
      outroDefeatScript: {
        id: "ch2_defeat",
        bannerTitle: "羅生門崩裂 · 紅蓮鬼火吞沒龍穴",
        bgStage: "rashomon",
        bgm: "shrine_duel",
        lines: [
          {
            speaker: "ibaraki",
            emotion: "【狂笑揮刀】",
            left: "ren",
            right: "ibaraki",
            text: "「哈哈哈！荒神龍穴的雙倍靈脈歸本大爺了！九印落定，你的防線被徹底斬斷啦！」"
          },
          {
            speaker: "ren",
            emotion: "【重整旗鼓】",
            left: "ren",
            right: "ibaraki",
            text: "「龍穴格的權重改變了攻防次序……不能用普通下法應對，重布九宮結界再戰！」"
          }
        ]
      },
      banter: {
        opening: "「荒神龍穴已開！經過龍穴者靈脈翻倍，九印落滿見真章，出招吧！」",
        normal: [
          "「喝啊！這一宮由本大爺的紅蓮鬼王印鎮壓！」",
          "「力道不錯，但還破不了羅生門的鐵壁！」",
          "「盯緊龍穴了嗎？分心的話下一刀就斬斷你的靈脈！」",
          "「痛快！離九印滿盤越來越近了！」"
        ],
        counter: [
          "「斬！這條靈脈本大爺一刀劈斷了！」",
          "「太慢了！想連成三印？問過本大爺的鬼角黑雷沒有！」",
          "「碎吧！你的佈局早被本大爺看穿了！」"
        ],
        midVeinHuman: "「居然先搶下一脈？！哈哈，但九印未滿，本大爺馬上連本帶利討回來！」",
        midVeinAI: "「紅蓮貫脈！本大爺領先了，剩下幾印看你怎麼掙扎！」",
        finaleWin: "「九印全滿，萬鬼咆哮！羅生門的勝利屬於本大爺茨木童子！」",
        finaleDraw: "「痛快！九印落盡竟能死死鎖住本大爺的龍穴攻勢，算你通過羅生門了！」"
      }
    },

    {
      index: 2,
      id: "ch3_kurama",
      chapterTag: "第三章",
      title: "鞍馬神風・雙重風門終戰",
      location: "京都・鞍馬山雲海天狗壇",
      stageKey: "kurama",
      ruleMode: "twin_gale",
      bgmBattle: "yokai_storm",
      bgmClimax: "yokai_storm",
      bossId: "tengu",
      introScript: {
        id: "ch3_intro",
        bannerTitle: "最終章 · 鞍馬雲海：銀翼大天狗・崇德嵐羽",
        bgStage: "kurama",
        bgm: "yokai_storm",
        lines: [
          {
            speaker: "narrator",
            emotion: "【雲海星河】",
            left: "ren",
            right: "tengu",
            text: "跨越重重山嵐登上鞍馬山雲海祭壇，銀河之下金葉飛旋。身披黑翼山伏法衣的大天狗手持羽扇，靜靜俯瞰整個京都萬家燈火。"
          },
          {
            speaker: "tengu",
            emotion: "【羽扇輕搖】",
            left: "ren",
            right: "tengu",
            text: "「連封玉藻前與茨木童子兩座大陣……神樂坂 蓮，今夜百鬼夜行最後的考驗，便在這雲海之巔的『鞍馬雙重風門陣』。」"
          },
          {
            speaker: "ren",
            emotion: "【仰視天狗】",
            left: "ren",
            right: "tengu",
            text: "「崇德嵐羽閣下……原來今夜靈脈騷動並非為了毀滅京都，而是千年一度重鑄地脈封印的試煉嗎？」"
          },
          {
            speaker: "tengu",
            emotion: "【翠瞳凜冽】",
            left: "ren",
            right: "tengu",
            text: "「若當代陰陽師軟弱無能，百鬼自當接管王城；若你真有晴明之才，便在南北或東西對稱開啟的『雙重風門（風門+1）』下，落滿九印與吾達成至高平衡吧！」"
          }
        ]
      },
      outroSealScript: {
        id: "ch3_seal",
        bannerTitle: "真結局 · 百鬼歸位與破曉的平安京",
        bgStage: "kurama",
        bgm: "eternal_seal",
        lines: [
          {
            speaker: "narrator",
            emotion: "【萬丈晨曦】",
            left: "ren",
            right: "tengu",
            text: "第九枚五芒星御守化作璀璨金芒貫入鞍馬祭壇！伏見、羅生門、鞍馬山三道靈脈同時共鳴，血月褪去，京都天際綻放出溫煦的破曉曙光！"
          },
          {
            speaker: "tengu",
            emotion: "【斂翼致敬】",
            left: "ren",
            right: "tengu",
            text: "「毫釐不差……在雙重風門與九印滿盤的極限推演中，你守住了人間與妖界最完美的平衡。吾崇德嵐羽，認可你為當代鎮護國家大陰陽師！」"
          },
          {
            speaker: "tamamo",
            emotion: "【遠方傳音】",
            left: "ren",
            right: "tamamo",
            text: "「呵呵，真教人刮目相看呢，小陰陽師。往後月圓之夜若覺得無聊，隨時歡迎再來九宮棋盤找妾身對弈喔～」"
          },
          {
            speaker: "ren",
            emotion: "【迎向朝陽】",
            left: "ren",
            right: "tengu",
            text: "「百鬼夜行，至此鎮魂禮成！只要陰陽相衡之道長存，京都的萬家燈火便會永遠延續下去！」"
          }
        ]
      },
      outroDefeatScript: {
        id: "ch3_defeat",
        bannerTitle: "神風席捲 · 雙重風門失衡",
        bgStage: "kurama",
        bgm: "yokai_storm",
        lines: [
          {
            speaker: "tengu",
            emotion: "【疾風羽嵐】",
            left: "ren",
            right: "tengu",
            text: "「心神尚有一絲紊亂。雙重風門會放大邊宮連線的價值，若忽視兩翼風穴，九印落盡時必遭天風反噬。」"
          },
          {
            speaker: "ren",
            emotion: "【深吸一口氣】",
            left: "ren",
            right: "tengu",
            text: "「多謝指點！看清南北與東西風門的對稱軸線，這一次我一定守住九印平衡！」"
          }
        ]
      },
      banter: {
        opening: "「鞍馬雙重風門已啟！兩翼風穴將賦予額外靈脈，請落第一印！」",
        normal: [
          "「神風隨行，此宮已入天狗羽翼之下。」",
          "「靜觀九宮流轉，每一步皆是天地定數。」",
          "「雙風門一動，邊路價值頓時倍增，看清了嗎？」",
          "「離九印圓滿只剩數步，保持澄明之心吧。」"
        ],
        counter: [
          "「嵐！迦樓羅疾風，截斷此脈！」",
          "「絕空羽刃！休想連通風門結界！」",
          "「封！你的棋路已在天狗神通預料之中！」"
        ],
        midVeinHuman: "「善哉，先奪一脈！然九印未終，且看天風如何流轉！」",
        midVeinAI: "「神風貫脈！天狗陣已占上風，最後幾印你當如何應對？」",
        finaleWin: "「九印俱落，天風浩蕩！此局由鞍馬山收下了，再行磨練吧。」",
        finaleDraw: "「萬籟俱寂，陰陽相衡！神樂坂 蓮，你已通過百鬼夜行最高試煉！」"
      }
    }
  ];

  /* --------------------------------------------------------------------------
     Codex Database (12 Rich Lore & Technical Entries)
     -------------------------------------------------------------------------- */
  const CODEX_ENTRIES = [
    {
      id: "codex_ren",
      category: "character",
      categoryLabel: "登場人物",
      title: "神樂坂 蓮（Kagurazaka Ren）",
      artType: "image",
      artSrc: "./assets/char_ren.jpg",
      desc: "陰陽寮最年輕的首席陰陽師，承襲安倍晴明一脈的『桔梗五芒星印』。深諳強行誅妖必傷地脈之理，故以九宮先手五枚熾陽御守布陣，追求與百鬼達成不敗不失的『陰陽相衡』。"
    },
    {
      id: "codex_tamamo",
      category: "character",
      categoryLabel: "百鬼大妖・第一章",
      title: "九尾妖狐・玉藻前（Tamamo-no-Mae）",
      artType: "image",
      artSrc: "./assets/char_tamamo.jpg",
      desc: "盤踞伏見千本鳥居的千年大妖，操縱幽藍蒼炎狐火。在棋盤上執後手四枚妖狐印，擅長以溫柔笑語誘導對手貪功搶連，再於終局第九手憑『奪脈先機』反殺。"
    },
    {
      id: "codex_ibaraki",
      category: "character",
      categoryLabel: "百鬼大妖・第二章",
      title: "羅生門鬼王・茨木童子（Ibaraki-doji）",
      artType: "image",
      artSrc: "./assets/char_ibaraki.jpg",
      desc: "鎮守九條羅生門廢墟的剛猛鬼王，額生赤金獨角、腰佩黑雷妖刀。對局時會喚醒單格『荒神龍穴（×2）』，令戰場充滿一擊翻盤的高風險殺機。"
    },
    {
      id: "codex_tengu",
      category: "character",
      categoryLabel: "百鬼大妖・第三章",
      title: "鞍馬大天狗・崇德嵐羽（Daitengu Arashiha）",
      artType: "image",
      artSrc: "./assets/char_tengu.jpg",
      desc: "棲息於鞍馬山雲海之巔的銀翼智將，百鬼夜行試煉的真正主持者。開啟對稱『雙重風門』改變邊宮權重，唯有算盡九手全局者方能與其平分秋色。"
    },
    {
      id: "codex_seal_ren",
      category: "seal",
      categoryLabel: "專屬靈印（非 O/X）",
      title: "【鎮魂・晴明五芒星熾陽御守】",
      artType: "svg",
      artSrc: "#seal-ren",
      desc: "徹底摒棄傳統井字棋單調的 X 符號，以朱砂雙環、四方御札與鎏金五芒星構成。落子瞬間伴隨神樂鈴清響與金色靈符粒子飛濺。"
    },
    {
      id: "codex_seal_bosses",
      category: "seal",
      categoryLabel: "專屬靈印（非 O/X）",
      title: "【百鬼三大妖王專屬靈印】",
      artType: "svg",
      artSrc: "#seal-tamamo",
      desc: "依戰役篇章自動切換後手棋子造型：第一章『九尾蒼炎妖狐印』、第二章『羅生門紅蓮鬼王印』、第三章『鞍馬天狗風神印』，每枚皆具獨立配色與衝擊特效。"
    },
    {
      id: "codex_fushimi",
      category: "seal",
      categoryLabel: "決戰舞台",
      title: "血月下的伏見與羅生門、鞍馬山",
      artType: "image",
      artSrc: "./assets/bg_fushimi.jpg",
      desc: "三大篇章分別對應『伏見夜櫻鳥居』、『羅生門雷雨斷橋』與『鞍馬山星河雲海』三幅高精細日本動漫背景與專屬環境粒子。"
    },
    {
      id: "codex_rule_9moves",
      category: "algorithm",
      categoryLabel: "核心規則設計",
      title: "九宮滿盤終局制（落滿 9 印方能結算）",
      artType: "svg",
      artSrc: "#seal-ibaraki",
      desc: "本作規定對局絕不在第 5～8 手提前中止！中途連成三印會即時射出光束鎖定加分，但雙方必須繼續落滿全部 9 顆棋子才觸發終局奧義大結算，讓第 6～9 手充滿雙線反超與先機博弈。"
    },
    {
      id: "codex_algo_minimax",
      category: "algorithm",
      categoryLabel: "不敗演算法秘卷",
      title: "9 手終局 Minimax + 整數置換表快取",
      artType: "svg",
      artSrc: "#seal-tengu",
      desc: "AI 將盤面 3^9 狀態、奪脈先機與先後手編碼為單一整數鍵存入置換表，完整推演至第 9 手滿盤終局並以『最大陷阱率』打破平手同分分支。經窮舉全部 945 條玩家落子序列驗證：玩家勝率 0.00%，AI 100% 不敗！"
    },
    {
      id: "codex_perf_guard",
      category: "algorithm",
      categoryLabel: "效能與相容工程",
      title: "離屏貼圖快取 × 三段自動畫質護航",
      artType: "image",
      artSrc: "./assets/bg_kurama.jpg",
      desc: "全面捨棄高耗能 shadowBlur，改用預渲染離屏光暈貼圖與 260 槽固定物件池。內建即時 FPS 監測器，掉幀時優先簡化粒子，無 GPU 加速時自動切換純 CSS/SVG 相容模式，免改任何瀏覽器設定即可流暢遊玩。"
    }
  ];

  /* --------------------------------------------------------------------------
     Onmyoji Achievements & Rank System (12 Unlockable Trophies)
     -------------------------------------------------------------------------- */
  const ACHIEVEMENTS = [
    { id: "first_drop", icon: "⛩️", title: "初入鬼門", desc: "施放第一枚晴明五芒星熾陽御守" },
    { id: "full_nine", icon: "☯️", title: "九宮圓滿", desc: "完整下滿全部 9 顆靈印完成第一場終局結算" },
    { id: "seal_tamamo", icon: "🦊", title: "伏見鎮魂師", desc: "於第一章與九尾妖狐・玉藻前達成『陰陽相衡』封印" },
    { id: "seal_ibaraki", icon: "👹", title: "羅生止雷者", desc: "於第二章荒神龍穴戰與茨木童子達成『陰陽相衡』封印" },
    { id: "seal_tengu", icon: "🦅", title: "鞍馬天風行者", desc: "於第三章雙重風門戰與崇德嵐羽達成『陰陽相衡』封印" },
    { id: "true_ending", icon: "👑", title: "鎮護國家大陰陽師", desc: "成功封印三大妖王，解鎖百鬼夜行真結局" },
    { id: "mid_vein", icon: "⚡", title: "先聲奪脈", desc: "在第 5 或第 7 手率先貫通一道靈脈並續戰至 9 印滿盤" },
    { id: "countered", icon: "💥", title: "見識妖王破陣", desc: "聽牌時遭大妖觸發必殺落雷『破！／斬！／嵐！』攔截" },
    { id: "story_choice", icon: "📖", title: "言靈交鋒", desc: "在視覺小說劇情中完成一次對話選項抉擇" },
    { id: "eye_of_onmyo", icon: "👁️", title: "開眼窺天機", desc: "開啟『陰陽天眼』檢視 Minimax 即時推演評分" },
    { id: "veteran_5", icon: "🔥", title: "百夜對弈", desc: "累計完成 5 場九宮滿盤對局" },
    { id: "replay_viewer", icon: "🎞️", title: "覆盤求道", desc: "進入棋譜回放劇場檢視歷史對局紀錄" }
  ];

  const RANKS = [
    { minTrophies: 0, title: "陰陽寮學徒" },
    { minTrophies: 2, title: "得業陰陽生" },
    { minTrophies: 4, title: "少允陰陽師" },
    { minTrophies: 6, title: "五位陰陽博士" },
    { minTrophies: 9, title: "首席鎮魂陰陽師" },
    { minTrophies: 11, title: "晴明真傳・大陰陽師" }
  ];

  window.HW06_DATA = {
    CHARACTERS,
    PROLOGUE_SCRIPT,
    CHAPTERS,
    CODEX_ENTRIES,
    ACHIEVEMENTS,
    RANKS
  };
})();

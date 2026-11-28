/* 1142949 HW06 — 全部配音台詞表（tools/make_voices.ps1 直接讀這個檔產生音檔；改台詞只要改這裡） */
window.HW06_VOICE_LINES = {
 "lines": [
  {
   "id": "r_pro1",
   "char": "ren",
   "kind": "line",
   "text": "神樂坂蓮，參上！等九枚靈印全部落下，我會用陰陽平衡之局，封住京都的鬼門！"
  },
  {
   "id": "r_pro2",
   "char": "ren",
   "kind": "line",
   "text": "正合我意！我的五枚御守，對上妳的四枚狐印。第一手，開陣！"
  },
  {
   "id": "r_seal",
   "char": "ren",
   "kind": "line",
   "text": "伏見的靈脈平靜下來了！下一站，雷雨中的羅生門！"
  },
  {
   "id": "r_defeat",
   "char": "ren",
   "kind": "line",
   "text": "我的式神結界還在！這次一定要看穿第九手的陷阱，再來一局！"
  },
  {
   "id": "r_win",
   "char": "ren",
   "kind": "line",
   "text": "九印到齊——伏見靈脈，封印！"
  },
  {
   "id": "r_vein",
   "char": "ren",
   "kind": "chant",
   "text": "靈脈，連成了！"
  },
  {
   "id": "r_m0",
   "char": "ren",
   "kind": "chant",
   "text": "第一道靈符，結界成形！"
  },
  {
   "id": "r_m1",
   "char": "ren",
   "kind": "chant",
   "text": "護身結界，展開！"
  },
  {
   "id": "r_m2",
   "char": "ren",
   "kind": "chant",
   "text": "熾陽火符，去！"
  },
  {
   "id": "r_m3",
   "char": "ren",
   "kind": "chant",
   "text": "四方封鎖！"
  },
  {
   "id": "r_m4",
   "char": "ren",
   "kind": "chant",
   "text": "五芒鎮魂，封！"
  },
  {
   "id": "r_c0",
   "char": "ren",
   "kind": "chant",
   "text": "晴明破魔印！"
  },
  {
   "id": "r_c1",
   "char": "ren",
   "kind": "chant",
   "text": "這條線，我擋下了！"
  },
  {
   "id": "r_c2",
   "char": "ren",
   "kind": "chant",
   "text": "熾陽金剛障！"
  },
  {
   "id": "t_pro1",
   "char": "tamamo",
   "kind": "line",
   "text": "呵呵呵……帶著晴明五芒星的年輕陰陽師，敢接下妾身這場九印滿盤的百鬼殺陣嗎？"
  },
  {
   "id": "t_pro2",
   "char": "tamamo",
   "kind": "line",
   "text": "看好了，小陰陽師。就算中途連成三印也不能停，要下滿九印，才分得出勝負。"
  },
  {
   "id": "t_seal",
   "char": "tamamo",
   "kind": "line",
   "text": "了不起……九印都下完了，竟然找不到一點破綻。"
  },
  {
   "id": "t_defeat",
   "char": "tamamo",
   "kind": "line",
   "text": "呵呵呵，九印落定，伏見靈脈歸妾身了。太心急，可是陰陽師的大忌喔。"
  },
  {
   "id": "t_open",
   "char": "tamamo",
   "kind": "line",
   "text": "丑時到了，陰陽師。等九宮全部下滿，就看誰能掌握伏見靈脈！"
  },
  {
   "id": "t_fwin",
   "char": "tamamo",
   "kind": "line",
   "text": "九印落滿，百鬼夜行開始了！今晚伏見靈脈歸妾身所有，呵呵呵！"
  },
  {
   "id": "t_fdraw",
   "char": "tamamo",
   "kind": "line",
   "text": "九宮下滿，陰陽平衡……你一步都沒算錯。好吧，伏見結界就照約定平息吧。"
  },
  {
   "id": "t_vein",
   "char": "tamamo",
   "kind": "chant",
   "text": "蒼炎，連成一線。"
  },
  {
   "id": "t_m0",
   "char": "tamamo",
   "kind": "chant",
   "text": "狐火，起。"
  },
  {
   "id": "t_m1",
   "char": "tamamo",
   "kind": "chant",
   "text": "蒼炎雙尾陣。"
  },
  {
   "id": "t_m2",
   "char": "tamamo",
   "kind": "chant",
   "text": "狐絲，纏住你。"
  },
  {
   "id": "t_m3",
   "char": "tamamo",
   "kind": "chant",
   "text": "九尾蒼炎，落。"
  },
  {
   "id": "t_c0",
   "char": "tamamo",
   "kind": "chant",
   "text": "妾身先一步。"
  },
  {
   "id": "t_c1",
   "char": "tamamo",
   "kind": "chant",
   "text": "這點心思，瞞不過妾身。"
  },
  {
   "id": "t_c2",
   "char": "tamamo",
   "kind": "chant",
   "text": "這條靈脈，歸我了。"
  }
 ],
 "chants": {
  "ren": {
   "moves": [
    "r_m0",
    "r_m1",
    "r_m2",
    "r_m3",
    "r_m4"
   ],
   "counters": [
    "r_c0",
    "r_c1",
    "r_c2"
   ],
   "vein": "r_vein"
  },
  "tamamo": {
   "moves": [
    "t_m0",
    "t_m1",
    "t_m2",
    "t_m3"
   ],
   "counters": [
    "t_c0",
    "t_c1",
    "t_c2"
   ],
   "vein": "t_vein"
  }
 }
};

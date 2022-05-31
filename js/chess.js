({
  "jsdom": {"file": "index.php"}, // Located in project root
});

/*jshint supernew: true, globals: true, evil: true, loopfunc: true, boss: true, expr: true, devel: true, scripturl: true, -W018, -W014*/
"use strict";
(e =>
{
  const elBoard = document.getElementById("board"),
        elCaptB = document.getElementById("capturedB"),
        elCaptW = document.getElementById("capturedW"),
        elPromotion = document.getElementById("promotion"),
        elContent = document.getElementById("content"),
        elCell = document.createElement("li"),
        elTimeTotal = document.getElementById("timeTotal"),
        elTimeTurn = document.getElementById("timeTurn"),
        elTimeWhite = document.getElementById("timeWhite"),
        elTimeBlack = document.getElementById("timeBlack"),
        elCaptured = document.getElementById("captured"),
        elReset = document.getElementById("reset");
  
  let clone,
      targetPrev,
      x,y,prevX,prevY;

  class Chess
  {
    get pieces()
    { return {
        list: ["", "♚","♚","♛","♛","♜","♜","♝","♝","♞","♞","♟","♟",""/*en passant*/], //white odd, black even
        type: ["", "k", "k", "q", "q", "r", "r", "b", "b", "n", "n", "p", "p", "e"],
        name: ["", "King", "King", "Queen", "Queen", "Rook", "Rook", "Bishop", "Bishop", "Knight", "Knight", "Pawn", "Pawn", "En Passant"],
        k: 1,K: 2,
        q: 3,Q: 4,
        r: 5,R: 6,
        b: 7,B: 8,
        n: 9,N: 10,
        p: 11,P: 12,
        e: 13, //en passant
        1: "k",2:"K",
        3: "q",4:"Q",
        5: "r",6:"R",
        7: "b",8:"B",
        9: "n",10:"N",
        11:"p",12:"P",
        13:"e",
        0: "", "":0, " ":0
      };
    }

    constructor(data, historyIndex)
    {
      this.init(data, historyIndex);
    }

    init(data, historyIndex)
    {
      this.stats = {
        pieces: {},
        moves: 0,
        history: [],
        time: {
          started: 0,
          last: 0,
          black: {
            total: 0,
            lastMove: 0
          },
          white: {
            total: 0,
            lastMove: 0
          }
        },
        captured: [],
        enpassant: { //https://en.wikipedia.org/wiki/Chess#En_passant
          black: 0,
          white: 0
        },
        castling: { //https://en.wikipedia.org/wiki/Chess#Castling
          black: 0,
          white: 0
        },
        promotion: { //https://en.wikipedia.org/wiki/Chess#Promotion
          black: 0,
          white: 0
        },
        check: {
          black: 0,
          white: 0
        }
      };
      this.mustMove = true;
      this.pieceMustMove = null;
      this.piece = null; //active piece
      this.check = false;
      this.checkmate = false;
      this.timer = null;
      if (data !== undefined)
        data = typeof data == "string" ? data : this.load(data);

      if (!data)
        data = this.default;


      this.table = [...new Array(64)].fill(0);

      if (Object.seal)
        Object.seal(this.table);

      const history = data.substr(64),
            info = history.split("|"),
            historyList = history.match(/([0-9]*[0-9]{2}[kqrbnpKQRBNP][0-9]{2}([kqrbnpKQRBNPe])?)/g)||[],
            preview = data.substr(0, 64);

      for(let i = 0, data = historyList.length || !preview ? this.default : preview; i < 64; i++)
        this.table[i] = this.pieces[data[i]];

      this.stats.time.started = info[0];
      if (this.stats.time.started)
      {
        this.stats.time.started = new Date(Number(this.stats.time.started));
        this.stats.time.last = this.stats.time.started;
        this.timerStart();
        // this.timerShow();
      }

      this.castling = [3,3];
      this.captured = [];
      this.turn = true;
      for(let i = 0, prev = null; i < historyList.length; i++)
      {
        if (prev === historyList[i])
          continue;
    
        const m = this.hist2move(historyList[i]);
        if (m.tID && this.pieces.type[m.pID] == "p" && this.pieces.type[m.tID] != "e" && m.pID % 2 == m.tID % 2)
          this.promote(m.pIndex, m.pID, m.tID);
        else
          this.movePiece(this.table, m.pIndex, m.tIndex, undefined, m.time);

        prev = this.stats.history[this.stats.history.length-1];
      }
      if (info.length > 2)
        this.pieceMustMove = info[info.length-1];
    }

    get default()
    {
      return "rnbqkbnrpppppppp                                PPPPPPPPRNBQKBNR";
    }

    reset()
    {
      this.init();
    }

    isPromotion(index)
    {
      const side = this.table[index] % 2,
            type = this.pieces.type[this.table[index]];

      return !(type != "p" || (index < [64, 56][side] && index > [7, -1][side]));
    }

    getMoves(index, check, silent)
    {
      const piece = this.table[index],
            _data = check || [...this.table],
            side = piece % 2,
            dir = side ? 1 : -1,
            [x, y] = this.i2xy(index),
            r = [],
            move = (xo, yo) => [x + dir * xo, y + dir * yo],
            one = move(1),
            type = this.pieces.type[piece],
            steps = type == "k" ? 2 : 9,
            canMoveTo = (xy, notEmpty, enpassant) =>
            {
              let pieceDest = _data[this.xy2i(...xy)],
                  colorDest = pieceDest == this.pieces.e && enpassant ? !side : pieceDest % 2;

              if (!enpassant && pieceDest == this.pieces.e)
                pieceDest = 0;

              if (pieceDest && colorDest != side)
                return pieceDest;

              return (!notEmpty && pieceDest === 0);
            };

      if (!check)
      {
        const moves = this.getMoves(index, _data);
        _data[index] = 0;
        const castling = [];
        if (type == "k")
        {
          if (this.castling[~~!side] & 1)
            castling.push([59, 3][side]);
          if (this.castling[~~!side] & 2)
            castling.push([61, 5][side]);
        }

        for (let n = 0, d, prev; n < moves.length; n++)
        {
          d = [..._data];
          d[moves[n]] = piece;
          if (this.isCheck(side, d, silent) || Math.abs(prev - moves[n]) == 1) // king castling crossing attacked square?
          {
            if (castling.indexOf(moves[n]) != -1)
              prev = moves[n];

            if (this.pieces.type[_data[moves[n]]] != "k")
              moves.splice(n--, 1);
          }
        }
        return moves;
      }
      let d;

      if (type == "p") //pawn
      {
        d = move(0, 1);
        let c = canMoveTo(d);

        if (c === true)
        {
          r.push(c > 0 ? this.xy2i(...d) : c);
          d = move(0, 2);
          c = canMoveTo(d);
          if (((side && y == 1) || (!side && y == 6)) && c === true)
            r.push(this.xy2i(...d));
        }
        d = move(-1, 1);
        if (canMoveTo(d, true, true))
          r.push(this.xy2i(...d));

        d = move(1, 1);
        if (canMoveTo(d, true, true))
          r.push(this.xy2i(...d));
      }
      if (type == "r" || type == "q" || type == "k") // rook // queen // king
      {
        for (let i = 1, c, path = []; i < steps; i++)
        {
          //top
          d = move(0, -i);
          c = canMoveTo(d);
          if (!path[0] && c) r.push(this.xy2i(...d));
          if (c !== true) path[0] = 1;

          //right
          d = move(i, 0);
          c = canMoveTo(d);
          if (!path[1] && c) r.push(this.xy2i(...d));
          if (c !== true) path[1] = 1;

          //bottom
          d = move(0, i);
          c = canMoveTo(d);
          if (!path[2] && c) r.push(this.xy2i(...d));
          if (c !== true) path[2] = 1;

          //left
          d = move(-i, 0);
          c = canMoveTo(d);
          if (!path[3] && c) r.push(this.xy2i(...d));
          if (c !== true) path[3] = 1;
        }
      }
      if (type == "b" || type == "q" || type == "k") // bishop // queen // king
      {
        for (let i = 1, c, path = []; i < steps; i++)
        {
          //top right
          d = move(i, i);
          c = canMoveTo(d);
          if (!path[0] && c) r.push(this.xy2i(...d));
          if (c !== true) path[0] = 1;

          //bottom right
          d = move(i, -i);
          c = canMoveTo(d);
          if (!path[1] && c) r.push(this.xy2i(...d));
          if (c !== true) path[1] = 1;

          //bottom left
          d = move(-i, -i);
          c = canMoveTo(d);
          if (!path[2] && c) r.push(this.xy2i(...d));
          if (c !== true) path[2] = 1;

          // top left
          d = move(-i, i);
          c = canMoveTo(d);
          if (!path[3] && c) r.push(this.xy2i(...d));
          if (c !== true) path[3] = 1;
        }
      }
      if (type == "n") // knight
      {
        //top right
        d = move(1, 2);
        canMoveTo(d) && r.push(this.xy2i(...d));

        //top left
        d = move(-1, 2);
        canMoveTo(d) && r.push(this.xy2i(...d));

        //right top
        d = move(2, 1);
        canMoveTo(d) && r.push(this.xy2i(...d));

        //right bottom
        d = move(2, -1);
        canMoveTo(d) && r.push(this.xy2i(...d));

        //bottom right
        d = move(1, -2);
        canMoveTo(d) && r.push(this.xy2i(...d));

        //bottom left
        d = move(-1, -2);
        canMoveTo(d) && r.push(this.xy2i(...d));

        //left bottom
        d = move(-2, -1);
        canMoveTo(d) && r.push(this.xy2i(...d));

        //left top
        d = move(-2, 1);
        canMoveTo(d) && r.push(this.xy2i(...d));

      }
      if (type == "k" && !this.stats.pieces[piece]) // king castling
      {
        let rook = side ? 0 : 56; //left side
        if (this.castling[~~!side] & 1)
        {
          if (canMoveTo(move(-1 * dir, 0)) && canMoveTo(move(-2 * dir, 0)) && !_data[rook + 1])
            r.push(rook + 2);
        }
        rook = side ? 7 : 63; //right side
        if (this.castling[~~!side] & 2)
        {
          if (canMoveTo(move(1 * dir, 0)) && canMoveTo(move(2 * dir, 0)))
            r.push(rook - 1);
        }
      }

      //console.log(r);
      return r;
    } //getMoves()

    i2xy(i)
    {
      return [i % 8, ~~(i / 8)];
    }

    xy2i(x, y)
    {
      return x < 0 || y < 0 || x > 7 || y > 7 ? -1 : y * 8 + x;
    }

    hist2move(h)
    {
      const m = h.match(/([0-9]*)([0-9]{2})([kqrbnpKQRBNP])([0-9]{2})([kqrbnpKQRBNPe])?/)||[];
      return {
        pID: ~~this.pieces[m[3]],
        pIndex: ~~m[2],
        tID: ~~this.pieces[m[5]],
        tIndex: ~~m[4],
        time: ~~m[1] * 100
      };
    }

    move2hist(pID, pIndex, tID, tIndex, time)
    {
      time = Math.round(time / 100);
      return (time ? time : "") + ("" + pIndex).padStart(2,0) + this.pieces[pID] + ("" + tIndex).padStart(2,0) + this.pieces[tID];
    }

    movePiece(table, pIndex, tIndex, target, time)
    {
      let tID = table[tIndex],
          castlingIndex = [],
          ret = false;
    
      const pID = table[pIndex],
            pType = this.pieces.type[pID],
            tType = this.pieces.type[tID],
            pSide = pID % 2,
            tIDOrig = tID,
            tSide = (tType != "e" ? tID : ~~(!pSide)) % 2;
    
      if (tType != "k")
      {
        if (!this.stats.pieces[pID])
          this.stats.pieces[pID] = {
            moves: 0,
            captured: []
          };
    
        this.stats.pieces[pID].moves++;
        if (tID && tSide != pSide)
        {
          if (tType == "e")
          {
            if (pType == "p")
            {
              const nIndex = tIndex + (tSide ? 8 : -8);
              tID = table[nIndex];
              table[nIndex] = 0;
            }
            else
              tID = 0;
    
          }
          if (tID)
          {
            this.stats.pieces[pID].captured.push(tID);
            this.captured.push(tID);
          }
        }
        ret = {pID, tID};
        table[tIndex] = pID;
    
        let p;
        while ((p = table.indexOf(this.pieces.e)) != -1)
          table[p] = 0;
    
        const moved = pIndex - tIndex;
        /* castling move */
        if (pType == "k" && (moved == 2 || moved == -2))
        {
          const rook = tIndex + (moved > 0 ? -2 : 1);
    
          castlingIndex = [rook, pIndex + (moved > 0 ? -1 : 1)];
          table[castlingIndex[1]] = table[rook];
          table[rook] = 0;
        }
        table[pIndex] = 0;
        if (this.piece !== target)
        {
          let castlingSide = -1,
              castlingVal = [0, 0];
    
          if (pType == "k")
          {
            castlingSide = [4, 60].indexOf(pIndex);
          }
          if (pType == "r")
          {
            castlingSide = [0, 56, 7, 63].indexOf(pIndex);
            castlingVal = [2, 1];
          }
          if (castlingSide > -1)
            this.castling[~~(castlingSide % 2)] &= castlingVal[~~(castlingSide / 2 % 2)];
    
          this.turn = !this.turn;
          this.pieceMustMove = null;
    
          if (pType == "p")
          {
            //en passant
            if (Math.abs(pIndex - tIndex) == 16)
            {
              table[pIndex > tIndex ? tIndex + 8 : tIndex - 8] = this.pieces.e;
            }
    
          }
        }
      }
      const stats = this.stats.time[["black", "white"][pSide]],
            now = new Date();

      if (!this.stats.time.started)
      {
        this.stats.time.started = now;
        this.stats.time.last = now;
      }

      stats.lastMove = time !== undefined ? time : now - this.stats.time.last;
      stats.total += stats.lastMove;
      this.stats.time.last = time !== undefined ? new Date(this.stats.time.last.getTime() + time) : now;
      this.stats.history.push(this.move2hist(pID, pIndex, tIDOrig, tIndex, stats.lastMove));
      if (castlingIndex.length)
        this.stats.history.push(this.move2hist(table[castlingIndex[1]], castlingIndex[0], table[castlingIndex[1]], castlingIndex[1], stats.lastMove));
            //console.log(this.stats);
if(!time)console.log(this.stats);
      return ret;
    }

    promote(pIndex, pID, tID)
    {
      this.table[pIndex] = tID;
      this.stats.history.push(this.move2hist(pID, pIndex, tID, pIndex));

    }

    isCheck(side, d, silent)
    {
      if (!d)
        d = [...this.table];

      const king = d.indexOf(side ? this.pieces.k : this.pieces.K);
      for (let i = 0, m; i < 64; i++)
      {
        if (d[i] && side != d[i] % 2)
        {
          m = this.getMoves(i, d);
          if (!silent)
          {
            m.forEach(a =>
            {
              if (!elBoard.children[a].m)
                elBoard.children[a].m = {};

              elBoard.children[a].m[d[i]] = this.pieces.list[d[i]];
              const b = Object.keys(elBoard.children[a].m).map(p => this.pieces.list[p]).join("");
              elBoard.children[a].dataset["canmove" + (side ? "B" : "W")] = (b.slice(8) ? b.slice(8) + "\n" : "") + (b.slice(4, 8) ? b.slice(4, 8) + "\n" : "") + b.slice(0, 4);
            });
          }
          if (m.indexOf(king) != -1)
          {
            this.check = true;
            return true;
          }

        }
      }
      this.check = false;

      return false;
    }

    load(id)
    {
      return localStorage.getItem("chess" + (id || ""));
    }

    save(id)
    {
      console.log(this.data);
      return localStorage.setItem("chess" + (id || ""), this.data);
    }

    get data()
    {
      const r = [""];
      for (let i = 0; i < 64; i++)
        r[0] += this.pieces[this.table[i]]||" ";

      if (this.stats.time.started)
        r[r.length] = this.stats.time.started.getTime();

      if (this.stats.history.length)
        r[r.length] = "|" + this.stats.history.join("");

console.log(this.pieceMustMove);
      if (this.pieceMustMove !== null)
        r[r.length] = "|" + this.pieceMustMove;

      return r.join("");
    }

    timerFormat(t)
    {
      const seconds = t / 1000,
            sec = Math.round(seconds),
            d = ~~(sec / 86400),
            h = ~~((sec % 86400) / 3600),
            m = ~~((sec % 3600) / 60),
            s = Math.round(sec % 60);
      return [
        d || h ? (d ? d + "d": "") + (""+h).padStart(2, 0) : 0,
        (h || d || m) ? (""+m).padStart(2,0) : 0,
        (""+s).padStart(2,0) + (seconds - ~~seconds).toFixed(1).substr(1,2)
      ].filter(Boolean).join(':');
    }

    timerShow()
    {
      const now = new Date(),
            turn = now - this.stats.time.last;

      elTimeTurn.textContent = this.timerFormat(turn);
      elTimeTotal.textContent = this.timerFormat(now - this.stats.time.started);
      let timeTotalWhite = this.stats.time.white.total,
          timeTotalBlack = this.stats.time.black.total;

      if (this.turn)
        timeTotalWhite = turn + timeTotalWhite;
      else
        timeTotalBlack = turn + timeTotalBlack;

      elTimeWhite.textContent = this.timerFormat(timeTotalWhite);
      elTimeBlack.textContent = this.timerFormat(timeTotalBlack);
      if (this.checkmate)
        return true;
    }

    timerStart()
    {
      this.timerStop();
      const that = this;
      let prevTimestamp = 0;
      !function loop(timestamp)
      {
        if (timestamp - prevTimestamp > 100)
        {
          prevTimestamp = timestamp;
          if (that.timerShow())
            return;
        }
        that.timer = requestAnimationFrame(loop);
      }();
    }

    timerStop()
    {
      console.log(this.timer);
      cancelAnimationFrame(this.timer);
    }
  
  }
//  const chess = new Chess("r0n16k31b6r7p48p33p12p38P27q41n1K59p13p10b18P8P49P50p53P14P55R40N57B60Q25B61N62R63c3C3TaPPp"); //[...new Array(64)].fill(0);
  // const chess = new Chess("Q2p10p13n16q18k19e20p28K35Q37p38P55N62R63c0C0TaPPprBqPnQrNqRbbBPpP"); //[...new Array(64)].fill(0);
  // const chess = new Chess("rnbqkbnrpppppppp                                PPPPPPPPRNBQKBNR"); //default
//  const chess = new Chess(0); // reload last session
  elPromotion.querySelectorAll(".cell").forEach((e, i) =>
  {
    e.dataset.piece = Chess.prototype.pieces.list[i * 2 + 3];
  });

  const chess = new Chess(0);
  updateBoard();
  selectPiece(chess.pieceMustMove);

  elBoard.appendChild(document.querySelector(".overlay"));
  function updateBoard(clear)
  {
    elBoard.classList.toggle("black", !chess.turn);
    chess.table.forEach((p, i) =>
    {
      const s = elBoard.children[i] || elCell.cloneNode(false),
            nomoves = s.classList.contains("nomoves");

      if (clear !== false)
        s.className = "cell";
      else
        s.classList.add("cell");

      s.classList.toggle("black", p && !(p % 2));
      s.classList.toggle("nomoves", nomoves);
      s.classList.remove("promotion");
      s.title = chess.pieces.name[p];
      s.classList.toggle("active", s === chess.piece);

      s.textContent = " " + i;
      s.dataset.piece = chess.pieces.list[p] || "";
      if (clear !== false)
      {
        delete s.dataset.canmoveW;
        delete s.dataset.canmoveB;
        delete s.m;
      }
      if (!elBoard.children[i])
        elBoard.appendChild(s);

    });
    chess.table.forEach((p, i) =>
    {
      elBoard.children[i].classList.toggle("available", p && p % 2 == chess.turn && chess.getMoves(i, undefined, true).length);
    });
    /* display captured pieces */
    let it = [0, 0];
    chess.captured.forEach(p =>
    {
      const type = p % 2,
        el = type ? elCaptW : elCaptB,
        i = it[type]++,
        s = el.children[i] || elCell.cloneNode(false);

      s.className = "cell";
      s.classList.toggle("black", !type);
      s.dataset.piece = chess.pieces.list[p] || "";
      s.title = chess.pieces.name[p];
      if (!el.children[i])
        el.appendChild(s);
    });
    while (it[0] < elCaptB.children.length)
      elCaptB.removeChild(elCaptB.lastChild);

    while (it[1] < elCaptW.children.length)
      elCaptW.removeChild(elCaptW.lastChild);

    if (elCaptured.dataset.piece)
    {
      const capt = (elCaptured.classList.contains("black") ? elCaptB : elCaptW).lastChild;
      elCaptured.classList.add("captured");
      elCaptured.style.left = capt.offsetLeft + "px";
      elCaptured.style.top = capt.offsetTop + "px";
      elCaptured.piece = capt;
      capt.classList.add("hidden");
    }
    const checkmate = [true, true],
          attacking = [],
          king = [chess.table.indexOf(chess.pieces.K), chess.table.indexOf(chess.pieces.k)];

    for (let i = 0, pID; i < chess.table.length; i++)
    {
      pID = chess.table[i];
      if (!pID)
        continue;

      const type = pID % 2,
            moves = chess.getMoves(i, undefined, true);

      if (!moves.length)
        continue;

      if (moves.indexOf(king[~~!type]) != -1)
        attacking.push(i);

      checkmate[type] = false;
    }
    attacking.forEach((a, i) =>
    {
      elBoard.children[a].classList.add("attacking");
      elBoard.children[king[~~!(chess.table[a] % 2)]].classList.add("check");

    });
    const turn = ~~chess.turn;
    if (checkmate[turn])
    {
      chess.checkmate = true;
      elBoard.children[king[turn]].classList.add("checkmate");
    }
    showPromotion();
    elContent.classList.toggle("black", !chess.turn);
  } //updateBoard()

  function showPromotion(index)
  {
    if (index === undefined)
    {
      for (let i = 0, index; i < 8; i++)
      {
        index = i;
        if (chess.table[index] == chess.pieces.P)
          showPromotion(index);

        index = i + 56;
        if (chess.table[index] == chess.pieces.p)
          showPromotion(index);
      }
      return false;
    }
    const target = elBoard.children[index],
          side = chess.table[index] % 2;

    if (!target || !chess.isPromotion(index))
      return false;

    elContent.classList.add("promotion");
    elPromotion.classList.toggle("black", !side);
    const rect = target.getBoundingClientRect();
    target.classList.add("promotion");
    elPromotion.style.top = rect.y + (side ? rect.height : 0) + "px";
    elPromotion.style.left = rect.x + "px";
    chess.piece = target;
    chess.turn = !chess.turn;

    return true;
  } //showPromotion()

  function selectPiece(index)
  {
    const piece = elBoard.children[index];
    if (!piece)
      return;

console.log(index, piece);
    if (!chess.getMoves(index, undefined, true).length)
    {
      piece.classList.add("nomoves");
      
      return;//updateBoard();
    }
    if (!chess.stats.time.started)
    {
      chess.stats.time.started = new Date();
      chess.stats.time.last = chess.stats.time.started;
      chess.timerStart();
    }
    if (chess.piece != piece)
    {
      chess.piece = piece;
      updateBoard(true);
    }

    chess.piece.moves = chess.getMoves(index);
    chess.piece.classList.toggle("active", true);
    chess.piece.moves.forEach(i => elBoard.children[i].classList.add("canmove"));
    return true;
  }

  function onMouseDown(e)
  {
    if (e.type == "mousedown")
      e.preventDefault();

    if (e.button || chess.checkmate || (e.target.parentNode !== elBoard && e.target.parentNode !== elPromotion))
      return;

    if (e.target.parentNode === elPromotion)
    {
      let pIndex = Array.prototype.indexOf.call(chess.piece.parentNode.children, chess.piece),
          promo = Array.prototype.indexOf.call(e.target.parentNode.children, e.target);

      chess.promote(pIndex, chess.table[pIndex], promo * 2 + 3 + ~~!(chess.table[pIndex] % 2));
      chess.turn = !chess.turn;
      chess.save();
      updateBoard();

      elContent.classList.remove("promotion");
      return;
    }

    if (elContent.classList.contains("promotion"))
      return;


    const piece = e.target;
    const index = Array.prototype.indexOf.call(piece.parentNode.children, piece),
          value = chess.table[index];

    if (!value || chess.turn != value % 2)
      return;

    if (chess.mustMove && chess.table[chess.pieceMustMove] && chess.pieceMustMove != index && chess.table[chess.pieceMustMove] % 2 == value % 2)
      return;

    if (!selectPiece(index))
      return;

console.log("index", index);
    chess.pieceMustMove = index;//chess.piece;
    clone = chess.piece.cloneNode(false);
    clone.classList.toggle("black", !(chess.table[index] % 2));
    clone.classList.remove("active");
    clone.classList.remove("attacking");
    x = chess.piece.clientWidth / 2;
    y = chess.piece.clientHeight / 2;
    elBoard.appendChild(clone);

    prevX = e.x !== undefined ? e.x : e.touches[0].clientX;
    prevY = e.y !== undefined ? e.y : e.touches[0].clientY;
    clone.classList.toggle("move", true);
    //    onMouseMove(e);
  }

  function onMouseMove(e)
  {
    if (!clone)
      return;

    e.stopPropagation();
    const curX = e.x !== undefined ? e.x : e.touches[0].clientX,
          curY = e.y !== undefined ? e.y : e.touches[0].clientY,
          pageX = e.x !== undefined ? e.pageX : e.touches[0].pageX,
          pageY = e.y !== undefined ? e.pageY : e.touches[0].pageY;

    if (curX != prevX || curY != prevY)
    {
      elBoard.classList.toggle("move", true);
    }
    prevX = curX;
    prevY = curY;
    clone.style.left = (curX + (pageX - curX) - x) + "px";
    clone.style.top = (curY + (pageY - curY) - y) + "px";
    let targets = document.elementsFromPoint(curX, curY),
        target = null;

    for (let i = 0; i < targets.length; i++)
    {
      if (targets[i] !== clone && targets[i].classList.contains("cell"))
      {
        target = targets[i];
        break;
      }
    }
    if (target)
    {
      if (targetPrev && target != targetPrev)
        targetPrev.classList.remove('over');

      targetPrev = target;
      const index = Array.prototype.indexOf.call(target.parentNode.children, target);
      target.classList.toggle("over", chess.piece.moves.indexOf(index) > -1);
    }
    else if (targetPrev)
    {
      targetPrev.classList.remove("over");
    }
  }

  function onMouseUp(e)
  {
    //  if (!clone)
    //    return;
    if (clone)
      elBoard.removeChild(clone);

    elBoard.classList.remove("move");
    clone = null;
    const curX = e.x !== undefined ? e.x : e.changedTouches[0].clientX,
          curY = e.y !== undefined ? e.y : e.changedTouches[0].clientY;

    let target = document.elementFromPoint(curX, curY),
        move = chess.piece ? false : null;

    if ((!target.closest("#board") && !target.closest("#promotion")) || target.matches(".overlay"))
      return;
  
    const tIndex = Array.prototype.indexOf.call(target.parentNode.children, target);
    if (target.parentNode === elBoard && chess.piece && chess.piece.moves && chess.piece.moves.indexOf(tIndex) > -1)
    {
      const pIndex = Array.prototype.indexOf.call(chess.piece.parentNode.children, chess.piece);
      move = chess.movePiece(chess.table, pIndex, tIndex);

      if (move)
      {
        elCaptured.dataset.piece = chess.pieces.list[move.tID];
        elCaptured.classList.toggle("black", move.pID % 2);
        elCaptured.style.left = target.offsetLeft + "px";
        elCaptured.style.top = target.offsetTop + "px";
      }
    }
    // const boardStatus = chess.string;
    chess.save();

console.log(chess.stats.history);
    if (move)
    {
//      chess.piece && delete chess.piece.moves;
      chess.piece = null;
    }
    updateBoard(move);
  }
  document.addEventListener("mousedown", onMouseDown, false);
  document.addEventListener("mouseup", onMouseUp, false);
  document.addEventListener("mousemove", onMouseMove, false);
  document.addEventListener("touchstart", onMouseDown, false);
  document.addEventListener("touchend", onMouseUp, false);
  document.addEventListener("touchmove", onMouseMove, false);
  document.addEventListener("contextmenu", e => e.preventDefault(), false);
  elReset.addEventListener("click", e => 
  {
    chess.reset();
    updateBoard();
  });

  function animationend(e)
  {
    if (e.target.classList.contains("nomoves"))
      e.target.classList.remove("nomoves");

    if (e.target.id == "captured")
    {
      e.target.classList.remove("captured");
      delete e.target.dataset.piece;
      e.target.removeAttribute("style");
      e.target.piece.classList.remove("hidden");
    }
  }
  elContent.addEventListener("animationend", animationend);
  elContent.addEventListener("transitionend", animationend);
})();


ISTARI: Tactic-based proof assistant for Martin-Lof type theory. IML (ML dialect) tactics manipulate LCF-style proof objects.

MCP OPS: open_document(path)→doc_id. PRIMARY: goto_line(doc_id,line) jumps+auto-rewinds context, attempt_tactic(doc_id,tactic) tries+validates+keeps/rollbacks. SECONDARY: show_current_goals(doc_id), list_constants(doc_id,module), get_type(doc_id,const), get_definition(doc_id,const), search_constants(doc_id,target).

WORKFLOW: goto_line to position → show_current_goals → attempt_tactic repeatedly until goal solved. Goto handles all context/rewinding automatically.

SYNTAX: openModule /Name/; loads module. defineInd /{vars}/ /cases of| pat1.body1 | pat2.body2// type/; defines inductive function. lemma "name" /stmt/; → tactics → qed();. Subgoals: {enter}/exit}. Variable intro: /x y z/ in tactics.

TACTICS: intro /vars/: introduce foralls/arrows into context. inference: unfold goal structure. induction /var/: induct on variable, creates subgoals for each constructor. reflexivity: prove t=t. rewrite /<- lemma/: rewrite right-to-left. rewrite /-> lemma/: left-to-right. rewrite /-> lemma in H/: rewrite in hypothesis H. so /proof/ /name/: apply proof, name result. exact /term/: finish goal with exact term.

LIBS: Preloaded: Nat,Bool,Integer,List,Logic,Function,Partial,Eventually,Quotient,Irrelevance. Load: File.load "f";. List: append, append_id_r (append xs nil = xs).

PROOF PATTERN (tail-call equivalence): (1) defineInd both versions (ntc=non-tail-call, tc=tail-call with accumulator). (2) Prove helper lemmas (e.g., append reassociation). (3) Prove STRONG lemma with accumulator: append(ntc xs)ys = tc xs ys (by induction on xs, use helper in cons case). (4) Main theorem: instantiate strong lemma with nil, rewrite to remove append.
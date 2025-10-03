ISTARI PROOF ASSISTANT REFERENCE

MCP: open_document(path)→doc_id. goto_line(doc_id,line) jumps+auto-rewinds. attempt_tactic(doc_id,tactic) tries+validates+keeps/rollbacks. show_current_goals(doc_id).

WORKFLOW: goto_line→show_current_goals→attempt_tactic loop until solved.

== DEFINITIONS ==

define /name args/ /body/ /type/;
- Define constant with type proof obligation
- Ex: define /double x/ /x + x/ /nat -> nat/;

defineInd /{pervasive}/ /fn : pattern of | pat1 . body1 | pat2 . body2 .../ /type/;
- Define inductive function on datatype
- Ex: defineInd /{a}/ /reverse_ntc : list [a] -> list a of | nil . nil | cons x xs . append (reverse_ntc xs) (cons x nil)// intersect i . forall (a : U i) . list a -> list a/;

definerec /name args/ /body/ /type/;
- Define recursive function
- Ex: definerec /length {a} l/ /list_case l 0 (fn h t . succ (length a t))/ /intersect i . forall (a:U i) . list a -> nat/;

typedef /datatype args . U i of name : type = | C1 : T1 | C2 : T2 .../;
- Define datatype with constructors
- Ex: typedef /datatype intersect i . forall (a:U i) . U i of tree : nat -> type = | Empty : tree 0 | Node : forall n . a -> tree n/;

reductions /lhs1 --> rhs1 ; lhs2 --> rhs2 ; unrolling name/;
- Install reduction rules
- Ex: reductions /length _ nil --> 0 ; length a (cons h t) --> succ (length a t) ; unrolling length/;

== IMPLICIT & INVISIBLE ARGUMENTS ==

{x} = implicit argument (auto-inserted as evar, resolved by unification)
- Ex: define /double_list {a} l/ /.../ /intersect i . forall (a:U i) . list a -> list a/;
- Usage: double_list mylist (a is auto-inferred)

intersect i . forall (a:U i) . T = invisible argument i (not in term, only for typing)
- Ex: List.map has type: intersect i . forall (a b : U i) . (a -> b) -> list a -> list b
- Usage: List.map F L (i, a, b all auto-inferred)

`f = suppress implicit arguments (use tick)
- Ex: `append a xs ys (explicitly provide implicit a)
- Ex: `List.map ap I A B F L (ap I provides invisible i=I, tick allows explicit A B)

_ = placeholder for unification (single underscore)
- Ex: `List.map _ _ F L (underscores filled by unification)

__ = placeholder in so/apply tactics (creates new subgoals)
- Ex: so /lemma __ x __/ /h/. (double underscores create proof obligations)

== TACTICS ==

intro /pat1 pat2.../.
- Introduce forall/arrow/intersect into context
- Ex: intro /i a xs ys/.

inference.
- Run typechecker to instantiate evars
- Ex: inference.

induction /var/.
- Induct on variable, creates case subgoals
- Ex: induction /xs/.

reflexivity.
- Prove t = t : A
- Ex: reflexivity.

rewrite /-> eq [targets]/.
- Rewrite left-to-right (M→N if eq : M=N:A), intermediate matching
- Ex: rewrite /-> Nat.plus_comm/. | rewrite /-> h in concl/. | rewrite /-> eq in h at 0 1/.

rewrite /--> eq [targets]/.
- Rewrite left-to-right, strict matching (no beta-equivalence)
- Ex: rewrite /--> Nat.plus_assoc/.

rewrite /<- eq [targets]/.
- Rewrite right-to-left (N→M if eq : M=N:A), intermediate matching
- Ex: rewrite /<- append_id_r in h/.

rewrite /<-- eq [targets]/.
- Rewrite right-to-left, strict matching
- Ex: rewrite /<-- h at all/.

so /term/ /name/.
- Apply term (use __ for holes), bind result to name
- Ex: so /lemma x __/ /h/.

exact /term/.
- Finish goal with term
- Ex: exact /h/.

split.
- Intro product/unit/future (no choices)
- Ex: split.

left. | right.
- Intro sum (left/right disjunct)
- Ex: left.

exists /term/.
- Intro existential with witness
- Ex: exists /0/.

destruct /hyp/ /pat/.
- Destruct hypothesis matching pattern
- Ex: destruct /h/ /x | y/. | destruct /h/ /x xs IH/.

apply /term/.
- Backchain through term (use __ for holes)
- Ex: apply /Nat.plus_comm/.

auto.
- Automated proving (depth 5)
- Ex: auto.

typecheck.
- Prove typechecking goal
- Ex: typecheck.

unfold /const [targets]/.
- Unfold constant definition, then weak-head-normalize
- Ex: unfold /double/. | unfold /f in h/. | unfold /g at 0/.

fold /term [targets]/.
- Fold target to become term (reverse of unfold)
- Ex: fold /double x/. | fold /f a in h/.

unroll /const [targets]/.
- Unroll recursive function using unrolling reduction
- Ex: unroll /length/. | unroll /factorial in h/.

reduce [/targets/].
- Normalize to normal form
- Ex: reduce. | reduce /in h/. | reduce /in concl at 0/.

assert /A/ /name/.
- Create subgoal to prove A, bind to name
- Ex: assert /x = 0 : nat/ /h/.

subst /hyp/.
- Find x=M in hyp, substitute x→M everywhere
- Ex: subst /h/.

exfalso.
- Replace goal with void
- Ex: exfalso.

== REWRITING ==

TARGETS: [in hyp] [at occurrences] | at occurrences (for concl) | (empty = "in concl at 0")
- occurrences: 0 1 2 (hit numbers, pre-order left-to-right) | pos 0 1 2 (positions) | all
- Ex: rewrite /-> h/. = rewrite in concl at first occurrence
- Ex: rewrite /-> h in concl at all/. = rewrite all occurrences in conclusion
- Ex: rewrite /-> h in eq at 0 1/. = rewrite hits 0,1 in hypothesis eq

BASIC REWRITING:
rewrite /-> eq/. - Replace M with N (if eq : M=N:A), searches conclusion at hit 0
rewrite /<- eq/. - Replace N with M (reverse direction)
rewrite /-> eq in h/. - Rewrite in hypothesis h
rewrite /-> eq in h at all/. - Rewrite all occurrences in h

EXAMPLE (from list_reverse.ist):
Goal: y :: append xs' (x :: ys) = y :: append (append xs' (x :: nil)) ys : list a
IH : append xs' (x :: ys) = append (append xs' (x :: nil)) ys : list a
Tactic: rewrite /<- IH/.
Result: y :: append xs' (x :: ys) = y :: append xs' (x :: ys) : list a (now trivial by reflexivity)

EXAMPLE 2 (from list_reverse.ist):
Goal: reverse_ntc xs = reverse_tc xs nil : list a
H : append (reverse_ntc xs) nil = reverse_tc xs nil : list a
Tactic: rewrite /-> append_id_r in H/.
Result: H becomes: reverse_ntc xs = reverse_tc xs nil : list a (then exact /H/.)

STRICT vs INTERMEDIATE:
- Intermediate (->, <-): Allows beta-equivalence, same head required (FAST, use by default)
- Strict (-->, <--): Exact syntactic match, no beta (use when intermediate fails or is ambiguous)
- When to use strict: Goal is "P (0 + 1 + x)", rewriting with "plus_assoc" on "E1+E2+E3" fails in intermediate mode because "0+1" beta-reduces to "1", use "--> plus_assoc" instead

OTHER REWRITES:
rewrite /M = N : A/. - Replace M with N, creates new subgoal to prove M=N:A
unfold /const/. - Unfold definition + weak-head-normalize
fold /term/. - Reverse of unfold
unroll /const/. - Unroll recursive function (for definerec)
reduce. - Normalize to normal form
whreduce. - Weak-head-normalize only

Supported relations: eq (=), eqtp (type eq), iff (<->), subtype (<:), implies.

== LIBS ==

Preloaded: Nat, Bool, Integer, List, Logic, Function, Partial, Eventually, Quotient, Irrelevance.
Load: File.load "filename";
Query: list_constants(doc_id,"List"), get_type(doc_id,"append"), get_definition(doc_id,"append").

List: append, append_id_r (append xs nil = xs), append_assoc.
Nat: plus_comm, plus_assoc, mult_comm, eqb.

== PROOF PATTERN: Tail-call equivalence ==

1. defineInd ntc (non-tail-call) and tc (tail-call with accumulator)
2. Prove helper (e.g., append reassociation)
3. Prove STRONG: append (ntc xs) ys = tc xs ys (induction xs, use helper in cons)
4. Main: instantiate strong with nil, rewrite append_id_r
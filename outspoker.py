import tkinter as tk
from tkinter import messagebox
from collections import Counter

VALEURS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']
COULEURS = ['♠', '♥', '♦', '♣']

cartes_selectionnees = []

def creer_carte(valeur, couleur):
    return f"{valeur}{couleur}"

def out_couleur():
    if len(cartes_selectionnees) < 5:
        messagebox.showwarning("Erreur", "Veuillez sélectionner au moins 5 cartes (main + flop)")
        return

    couleurs = [carte[-1] for carte in cartes_selectionnees]
    compteur = Counter(couleurs)
    couleur_possible = None
    for c in COULEURS:
        if compteur[c] >= 5-(7-len(cartes_selectionnees)):
            couleur_possible = c
            break

    if not couleur_possible:
        messagebox.showinfo("Résultat", "Couleur impossible avec les cartes actuelles")
        return

    cartes_vues = len(cartes_selectionnees)
    nb_couleur_vues = compteur[couleur_possible]
    outscouleur = 13 - nb_couleur_vues
    if 3<=compteur[c]<=5:
        couleur_manque=5-compteur[c]
    elif compteur[c]<3:
        couleur_manque=-1
    else:
        couleur_manque=0
    if couleur_manque==2:
        proba_turn=0
        proba_turn_river=(outscouleur / (52 - cartes_vues))*(outscouleur / (52 - cartes_vues))
    elif couleur_manque==1:
        proba_turn = outscouleur / (52 - cartes_vues)
        proba_turn_river = outscouleur / (52 - cartes_vues)+(outscouleur / (52 - cartes_vues))

    messagebox.showinfo("Résultat",
                        f"Couleur possible avec les {nb_couleur_vues} cartes {couleur_possible} visibles\n"
                        f"Outs: {outscouleur}\n"
                        f"Proba turn: {proba_turn:.2%}\n"
                        f"Proba turn + river: {proba_turn_river:.2%}")

fenetre = tk.Tk()
fenetre.title("Calculateur d'Outs Poker")

label_titre = tk.Label(fenetre, text="Sélectionnez vos cartes :", font=("Arial", 16))
label_titre.grid(row=0, column=0, columnspan=13, pady=10)

def selectionner_carte(valeur, couleur, bouton):
    carte = creer_carte(valeur, couleur)
    if carte in cartes_selectionnees:
        cartes_selectionnees.remove(carte)
        bouton.config(relief="raised", bg="SystemButtonFace")
    elif len(cartes_selectionnees) < 7:
        cartes_selectionnees.append(carte)
        bouton.config(relief="sunken", bg="lightgreen")
    else:
        messagebox.showwarning("Limite atteinte", "Vous ne pouvez sélectionner que 7 cartes maximum")

for i, valeur in enumerate(VALEURS):
    for j, couleur in enumerate(COULEURS):
        carte = creer_carte(valeur, couleur)
        bouton = tk.Button(fenetre, text=carte, width=4, height=2)
        bouton.grid(row=j+1, column=i, padx=2, pady=2)
        bouton.config(command=lambda v=valeur, c=couleur, b=bouton: selectionner_carte(v, c, b))

bouton_calcul = tk.Button(fenetre, text="Calculer les Outs", command=out_couleur, bg="skyblue")
bouton_calcul.grid(row=6, column=0, columnspan=13, pady=15)

fenetre.mainloop()

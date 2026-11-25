# Tab title: Electric fields

from commonFunctions import A,winlim,step,mag,rhat,Efield,sigma
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import CenteredNorm


#%% Set up plots
fig = plt.figure(1)
fig.clear()


ax1 = fig.subplots(1,1)

ax1.set_box_aspect(1)
ax1.set_xlabel("x (cm)")
ax1.set_ylabel("y (cm)")
ax1.set_xlim((-winlim,winlim))
ax1.set_ylim((-winlim,winlim))


rlist = np.linspace(0,2*winlim,201)
tlist = np.linspace(0,2*np.pi,101)
rg,tg = np.meshgrid(rlist,tlist)

xg = rg * np.cos(tg)
yg = rg * np.sin(tg)

qxlist = np.linspace(-winlim,winlim,20)
qxg,qyg = np.meshgrid(qxlist,qxlist)
# rg = mag(xg,yg)

# rx,ry = rhat(xg,yg)


#%%
# Begin ui controls
Q = 1e-9 # Vary between -3 and 3 nC
E0x = 0 # Make a polar plot/joystick control for Ex,Ey with max magnitude of 2000
E0y = 0
theta = 0 # angle picker, range 0 to pi/2, vertical=0 label=perp, horizontal=pi/2 label=parallel
induce = False # Make a toggle to show the effect of induced charges
# end controls


# Rerun anytime the controls are changed
Ex,Ey = Efield(xg,yg,Q,induce,E0x,E0y,theta)

a=ax1.contourf(xg,yg,mag(Ex,Ey),cmap='Blues') # leave as contour plot, colormap is white at 0 value, and blue at max value.
plt.colorbar(a) # main colorbar

if induce and ( mag(E0x,E0y) > 0):
    ax1.quiver(-E0y/(2*mag(E0x,E0y)),E0x/(2*mag(E0x,E0y)),E0x,E0y,pivot='mid',color='C0',label="Applied field")
    ax1.quiver(E0y/(2*mag(E0x,E0y)),-E0x/(2*mag(E0x,E0y)),-E0x,-E0y,pivot='mid',color='C1',label="Induced field")

b = ax1.quiver(qxg,qyg,*Efield(qxg,qyg,Q,induce,E0x,E0y,theta),color='C0')

# When converting to plotly, make this scatter plot a line plot with color data, use the color field in 'lines'
c =ax1.scatter(A*np.cos(tlist),A*np.sin(tlist),c=sigma(tlist,Q,induce,E0x,E0y),cmap='coolwarm_r',norm=CenteredNorm(),s=50)


# Header text for task section:
taskheader = """
For each question, express your answer in the form of a *modus tollens* proof. 
1. If A implies the conductor is not in electrostatic equilibrium,
2. The conductor is in fact in electrostatic equilibrium,
3. therefore A must be false.
"""
# Two tasks, both questions (no check condition)
task1 = {"type":'Question', "condition":"mag(E0x,E0y)>0", "prompt":"Apply a bulk field.",
         "question": "What must be true of the electric field in the bulk of a conductor in electrostatic equilibrium and why?"}
task2 = {"type":'Question', "condition":"(Q>0) and (theta>0)", "prompt":"Change the surface field.",
         "question": "What must be true of the electric field at the surface of a conductor in electrostatic equilibrium and why?"}



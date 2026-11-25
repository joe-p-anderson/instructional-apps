# PHY 4300: Electricity and Magnetism
# Activity title: Conductor properties
# Tab title: Potential field
import numpy as np
import matplotlib.pyplot as plt


A = 5
mag = lambda x,y : np.sqrt(x**2 + y**2)
def Efield(x,y,q):
    E = 0*x
    r2 = x**2 + y**2
    mask = r2 < A**2
    E[~mask] = 9e9 * q / r2[~mask] 
    return E *1e4

def rhat(x,y):
    mask= x**2 + y**2 != 0
    r = mag(x,y)
    rhatx = x.copy()
    rhaty = y.copy()
    rhatx[mask]= rhatx[mask]/r[mask]
    rhaty[mask]= rhaty[mask]/r[mask]
    return rhatx,rhaty


#%% Set up plots
winlim = 10

fig = plt.figure(1)
fig.clear()


ax1 = fig.subplots(1,1)

ax1.set_box_aspect(1)
ax1.set_xlabel("x (cm)")
ax1.set_ylabel("y (cm)")
# ax1.grid(which="major")
# ax1.set_xlim((0,winlim))
# ax1.set_ylim((-4,4))
# ax1.hlines(0,-1,winlim*2,linewidth=1,color='k')

#%% Declare grid and base fields
xlist = np.linspace(-winlim,winlim,201)
tlist = np.linspace(0,2*np.pi,101)
xg,yg = np.meshgrid(xlist,xlist)


rg = mag(xg,yg)

rx,ry = rhat(xg,yg)


Q = 1e-9
E = Efield(xg,yg,Q)
Ex = E*rx
Ey = E*ry


def potential(x,y):
    if mag(x,y) > A:
        return 9e9*Q/np.sqrt(x**2+y**2)
    else:
        return 9e9*Q/A

#%%
# Begin ui controls
x1 = -6 # No slider, only drag controls
y1 = -6# No slider, only drag controls
x2 = 7# No slider, only drag controls
y2 = 7# No slider, only drag controls
locktosurface = False
measureatInfinity = False
# end controls

# At the top of the control pane, display the potential difference in large font
if measureatInfinity:
    DeltaV = potential(x1,y1) - potential(x2,y2)
else:
    DeltaV = potential(x1,y1)

# If locktosurface, constrain points 1,2 to the surface (x**2 + y**2)=A**2
if measureatInfinity:
    x2 = x1/mag(x1,y1) * 12
    y2 = y1/mag(x1,y1) * 12
    
if locktosurface:
    t1 = np.arctan2(y1,x1)
    t2 = np.arctan2(y2,x2)
    tmin = min((t1,t2))
    tmax = max((t1,t2))
    t = np.linspace(tmin,tmax,100)
    ax1.plot(A*np.cos(t),A*np.sin(t),'k:',linewidth=2)
else:
    ax1.plot(np.array([x1,x2]),np.array([y1,y2]),'k:',linewidth=2)
    
ax1.plot(x1,y1,'o',color='C1') # Draggable point for x1,y1
ax1.plot(x2,y2,'o',color='k') # Draggable point for x2,y2


a=ax1.contourf(xg,yg,mag(Ex,Ey),cmap='Blues')
ax1.plot(A*np.cos(tlist),A*np.sin(tlist),'C0',linewidth=2)
step = 10
b = ax1.quiver(xg[::step,::step],yg[::step,::step],Ex[::step,::step],Ey[::step,::step],color='C0')

plt.colorbar(a)


"""
Tasks: 
    1. What is true about the potential field inside a conductor?
    1. How is the potential field at the surface of a conductor related to the value inside?
"""

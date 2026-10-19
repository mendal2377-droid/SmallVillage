"""Sky, light and fog presets for the painted village (linear RGB).

Single source for Blender renders and the web climate system (Phase 8). Each preset is matched to the
photographs where possible. Sun angles are typical for latitude ~33.4 N (Xiangcheng, Henan); `sun_el` and
`sun_az` are degrees (azimuth clockwise from north). `lit` / `shadow` tint the toon shader and act as its exposure (the toon output is emission-like, so
night and storm darken through these tints); `clouds` names
the cloud kit pieces that suit the weather.
"""

PRESETS = {
    "winter haze morning": dict(  # photos 02, 09, 10: pale disc of a sun in grey-cream haze
        horizon=(0.80, 0.76, 0.70), mid=(0.70, 0.70, 0.72), zenith=(0.55, 0.60, 0.68),
        sun_el=15, sun_az=135, sun=(1.0, 0.92, 0.80), sun_strength=2.6,
        ambient=(0.62, 0.62, 0.66), ambient_strength=0.62, lit=(1.04, 1.0, 0.94), shadow=(1.0, 0.98, 1.0),
        fog=(0.78, 0.76, 0.72), fog_density=0.0040, clouds=["cirrus"], season="winter"),
    "winter sunrise frost": dict(  # photo 16: orange sunrise over frosted wheat
        horizon=(1.0, 0.62, 0.32), mid=(0.74, 0.60, 0.62), zenith=(0.30, 0.38, 0.62),
        sun_el=4, sun_az=115, sun=(1.0, 0.60, 0.32), sun_strength=4.5,
        ambient=(0.55, 0.58, 0.74), ambient_strength=0.45, lit=(1.25, 0.92, 0.68), shadow=(0.90, 0.88, 1.05),
        fog=(0.86, 0.70, 0.60), fog_density=0.0018, clouds=[], season="winter"),
    "spring clear": dict(  # photos 13, 14: deep blue spring sky over green wheat
        horizon=(0.80, 0.86, 0.92), mid=(0.45, 0.62, 0.88), zenith=(0.10, 0.30, 0.80),
        sun_el=48, sun_az=165, sun=(1.0, 0.96, 0.88), sun_strength=4.5,
        ambient=(0.55, 0.64, 0.82), ambient_strength=0.45, lit=(1.10, 1.04, 0.92), shadow=(1, 1, 1),
        fog=(0.80, 0.86, 0.92), fog_density=0.0008, clouds=["cumulus small"], season="spring"),
    "summer afternoon": dict(  # style frames: big painted cumulus, warm light
        horizon=(0.94, 0.88, 0.78), mid=(0.60, 0.75, 0.90), zenith=(0.15, 0.37, 0.80),
        sun_el=55, sun_az=230, sun=(1.0, 0.90, 0.74), sun_strength=4.5,
        ambient=(0.56, 0.64, 0.82), ambient_strength=0.48, lit=(1.12, 1.02, 0.86), shadow=(1, 1, 1),
        fog=(0.86, 0.88, 0.90), fog_density=0.0007, clouds=["cumulus tower", "cumulus"], season="summer"),
    "overcast": dict(  # photos 07, 08: flat grey September day
        horizon=(0.78, 0.79, 0.80), mid=(0.70, 0.72, 0.75), zenith=(0.58, 0.61, 0.66),
        sun_el=40, sun_az=180, sun=(1.0, 1.0, 1.0), sun_strength=1.2,
        ambient=(0.70, 0.72, 0.76), ambient_strength=0.95, lit=(1.0, 1.0, 1.0), shadow=(1.02, 1.02, 1.04),
        fog=(0.74, 0.75, 0.77), fog_density=0.0022, clouds=["stratus"], season="autumn"),
    "golden sunset": dict(  # photo 15: orange sun setting behind poplar clumps
        horizon=(1.0, 0.62, 0.30), mid=(0.92, 0.66, 0.52), zenith=(0.30, 0.40, 0.70),
        sun_el=6, sun_az=285, sun=(1.0, 0.58, 0.30), sun_strength=5.5,
        ambient=(0.62, 0.55, 0.70), ambient_strength=0.5, lit=(1.30, 0.90, 0.62), shadow=(0.92, 0.84, 1.0),
        fog=(0.95, 0.70, 0.50), fog_density=0.0015, clouds=["cumulus"], season="summer"),
    "summer storm": dict(  # July-August thunderstorm: dark anvil, cool light
        horizon=(0.55, 0.56, 0.55), mid=(0.36, 0.38, 0.42), zenith=(0.22, 0.24, 0.30),
        sun_el=30, sun_az=250, sun=(0.90, 0.92, 1.0), sun_strength=1.4,
        ambient=(0.40, 0.44, 0.52), ambient_strength=0.9, lit=(0.74, 0.78, 0.86), shadow=(0.70, 0.73, 0.86),
        fog=(0.45, 0.47, 0.50), fog_density=0.0030, clouds=["thunderhead", "stratus"], season="summer"),
    "snow day": dict(  # photos 03, 05: soft white light, wet road
        horizon=(0.84, 0.85, 0.86), mid=(0.78, 0.80, 0.83), zenith=(0.66, 0.70, 0.76),
        sun_el=25, sun_az=170, sun=(1.0, 1.0, 1.0), sun_strength=1.2,
        ambient=(0.78, 0.80, 0.86), ambient_strength=0.95, lit=(1.0, 1.0, 1.04), shadow=(1.0, 1.0, 1.04),
        fog=(0.84, 0.85, 0.87), fog_density=0.0028, clouds=["stratus"], season="winter"),
    "dusk": dict(  # balcony photos 22, 24: blue hour with an orange band
        horizon=(0.86, 0.56, 0.40), mid=(0.40, 0.36, 0.50), zenith=(0.10, 0.12, 0.30),
        sun_el=2, sun_az=290, sun=(0.9, 0.60, 0.50), sun_strength=1.6,
        ambient=(0.34, 0.34, 0.52), ambient_strength=0.6, lit=(0.86, 0.68, 0.66), shadow=(0.60, 0.60, 0.80),
        fog=(0.50, 0.42, 0.50), fog_density=0.0016, clouds=["cirrus"], season="autumn"),
    "night": dict(  # moonlight; window glow comes from the climate system
        horizon=(0.08, 0.10, 0.18), mid=(0.04, 0.05, 0.12), zenith=(0.01, 0.02, 0.06),
        sun_el=40, sun_az=160, sun=(0.60, 0.70, 1.0), sun_strength=1.2,
        ambient=(0.18, 0.22, 0.36), ambient_strength=0.7, lit=(0.36, 0.42, 0.62), shadow=(0.26, 0.30, 0.50),
        fog=(0.06, 0.07, 0.12), fog_density=0.0012, clouds=[], season="summer"),
}

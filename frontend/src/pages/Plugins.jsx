import React, { useState, useEffect } from 'react';
import { serverApi } from '../api/server';
import { Search, Download, Check, AlertCircle, Package, Loader2, ExternalLink } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import clsx from 'clsx';

const Plugins = () => {
    const [query, setQuery] = useState('');
    const [plugins, setPlugins] = useState([]);
    const [searching, setSearching] = useState(false);
    const [installing, setInstalling] = useState(null); // projectId being installed
    const [isFocused, setIsFocused] = useState(false);
    const { showToast } = useToast();

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (query.length >= 2) {
                handleSearch();
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [query]);

    const handleSearch = async () => {
        setSearching(true);
        try {
            const results = await serverApi.searchPlugins(query);
            setPlugins(results);
        } catch (err) {
            console.error(err);
            showToast('Failed to search plugins', 'error');
        } finally {
            setSearching(false);
        }
    };

    const handleInstall = async (plugin) => {
        setInstalling(plugin.id);
        try {
            await serverApi.installPlugin(plugin.id, plugin.source);
            showToast(`Successfully installed ${plugin.name}`, 'success');
        } catch (err) {
            console.error(err);
            showToast(err.message || `Failed to install ${plugin.name}`, 'error');
        } finally {
            setInstalling(null);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 min-h-[80vh] flex flex-col">
            {/* Header & Search Section */}
            <div className={clsx(
                "flex flex-col items-center transition-all duration-500 ease-in-out",
                plugins.length > 0 || query.length > 0 ? "pt-0 mb-6" : "pt-20 mb-12"
            )}>
                <div className="text-center mb-8 space-y-2">
                    <h1 className="text-4xl font-bold text-white tracking-tight">Plugin Store</h1>
                    <p className="text-obsidian-muted text-lg max-w-md mx-auto">
                        Search and install plugins from Modrinth, Hangar, and Spigot.
                    </p>
                </div>

                <div className={clsx(
                    "relative transition-all duration-500 ease-out",
                    isFocused || query.length > 0 ? "w-full max-w-3xl" : "w-full max-w-lg"
                )}>
                    <div className={clsx(
                        "absolute inset-0 bg-obsidian-accent/20 blur-xl rounded-full transition-opacity duration-500 pointer-events-none",
                        isFocused ? "opacity-100" : "opacity-0"
                    )} />
                    <Search
                        className={clsx(
                            "absolute left-4 top-1/2 transform -translate-y-1/2 transition-colors duration-300 z-10 pointer-events-none",
                            isFocused ? "text-obsidian-accent" : "text-obsidian-muted"
                        )}
                        size={24}
                    />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        placeholder="Search for plugins..."
                        className={clsx(
                            "w-full bg-black/40 border-2 rounded-2xl pl-14 pr-6 py-4 text-lg text-white placeholder-obsidian-muted/50",
                            "focus:outline-none focus:border-obsidian-accent focus:bg-black/60 shadow-xl",
                            "transition-all duration-300 ease-out",
                            isFocused ? "border-obsidian-accent scale-105" : "border-obsidian-border hover:border-obsidian-border/80"
                        )}
                    />
                </div>
            </div>

            {/* Results Grid */}
            <div className={clsx(
                "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 transition-all duration-700 delay-100",
                plugins.length > 0 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
            )}>
                {searching && plugins.length === 0 ? (
                    <div className="col-span-full flex flex-col items-center justify-center py-12">
                        <Loader2 className="animate-spin text-obsidian-accent mb-4" size={40} />
                        <p className="text-obsidian-muted">Searching Modrinth...</p>
                    </div>
                ) : plugins.length > 0 ? (
                    plugins.map((plugin, idx) => (
                        <div
                            key={`${plugin.source}-${plugin.id}`}
                            className="group bg-obsidian-surface border border-obsidian-border rounded-xl p-5 flex flex-col hover:border-obsidian-accent/50 hover:bg-obsidian-surface/80 transition-all duration-300 hover:-translate-y-1 shadow-lg"
                            style={{ animationDelay: `${idx * 50}ms` }}
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center space-x-4">
                                    {plugin.iconUrl ? (
                                        <img src={plugin.iconUrl} alt={plugin.name} className="w-12 h-12 rounded-xl shadow-md bg-black/20" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-obsidian-bg to-obsidian-surface border border-obsidian-border flex items-center justify-center shadow-md">
                                            <Package size={24} className="text-obsidian-muted" />
                                        </div>
                                    )}
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            {plugin.webUrl ? (
                                                <a
                                                    href={plugin.webUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()} // Prevent card click
                                                    className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border hover:underline cursor-pointer flex items-center gap-1 ${plugin.source === 'Modrinth' ? 'text-green-400 border-green-400/20 bg-green-400/10' :
                                                        plugin.source === 'Hangar' ? 'text-blue-400 border-blue-400/20 bg-blue-400/10' :
                                                            'text-orange-400 border-orange-400/20 bg-orange-400/10'
                                                        }`}
                                                >
                                                    {plugin.source}
                                                </a>
                                            ) : (
                                                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${plugin.source === 'Modrinth' ? 'text-green-400 border-green-400/20 bg-green-400/10' :
                                                    plugin.source === 'Hangar' ? 'text-blue-400 border-blue-400/20 bg-blue-400/10' :
                                                        'text-orange-400 border-orange-400/20 bg-orange-400/10'
                                                    }`}>
                                                    {plugin.source}
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="font-bold text-lg text-white line-clamp-1 group-hover:text-obsidian-accent transition-colors" title={plugin.name}>{plugin.name}</h3>
                                        <div className="flex items-center text-xs text-obsidian-muted space-x-2 mt-0.5">
                                            <span>by {plugin.author}</span>
                                            <span className="w-1 h-1 rounded-full bg-obsidian-border" />
                                            <span>{Number(plugin.downloads).toLocaleString()} downls</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <p className="text-sm text-gray-400 mb-6 line-clamp-3 leading-relaxed flex-1">
                                {plugin.description}
                            </p>

                            <div className="flex items-center justify-between mt-auto pt-4 border-t border-obsidian-border/40">
                                <span className="text-xs font-medium text-obsidian-muted flex items-center">
                                    {plugin.source === 'Modrinth' && <img src="https://avatars.githubusercontent.com/u/112328906?s=48&v=4" className="w-4 h-4 mr-1.5 grayscale opacity-50" />}
                                    {plugin.source}
                                </span>

                                <button
                                    onClick={() => handleInstall(plugin)}
                                    disabled={installing === plugin.id}
                                    className={clsx(
                                        "px-4 py-2 rounded-lg text-sm font-semibold flex items-center transition-all duration-200 transform active:scale-95",
                                        installing === plugin.id
                                            ? "bg-obsidian-surface text-obsidian-muted cursor-wait border border-obsidian-border"
                                            : "bg-gradient-to-r from-obsidian-accent to-purple-600 hover:from-obsidian-accent-hover hover:to-purple-500 text-white shadow-lg hover:shadow-obsidian-accent/25"
                                    )}
                                >
                                    {installing === plugin.id ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin mr-2" />
                                            Installing...
                                        </>
                                    ) : (
                                        <>
                                            <Download size={16} className="mr-2" />
                                            Install
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    ))
                ) : null}
            </div>

            {/* Empty State / Initial Placeholder */}
            {!searching && plugins.length === 0 && query.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-obsidian-muted/20 animate-in fade-in zoom-in duration-700">
                    <Search size={120} strokeWidth={1} />
                    <p className="mt-6 text-xl font-medium text-obsidian-muted/40">Start typing to search plugins</p>
                </div>
            )}

            {!searching && plugins.length === 0 && query.length >= 2 && (
                <div className="flex-1 flex flex-col items-center justify-center text-obsidian-muted opacity-50 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <Package size={64} className="mb-4 text-obsidian-muted/50" />
                    <p className="text-lg">No plugins found matching "{query}"</p>
                </div>
            )}
        </div>
    );
};

export default Plugins;

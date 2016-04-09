/* @flow */

import type {
    Tag,
    DependencyKey,
    Annotation
} from 'reactive-di/i/coreInterfaces'

import type {
    ContainerManager,
    Context,
    Resolver,
    Provider,
    Plugin,
    RelationUpdater
} from 'reactive-di/i/coreInterfaces'

import type {
    ProviderManager
} from 'reactive-di/core/DiContainer'

import normalizeMiddlewares from 'reactive-di/core/normalizeMiddlewares'
import normalizeConfiguration from 'reactive-di/core/normalizeConfiguration'
import SimpleMap from 'reactive-di/utils/SimpleMap'
import getFunctionName from 'reactive-di/utils/getFunctionName'
import driver from 'reactive-di/core/annotationDriver'
import createPluginsMap from 'reactive-di/core/createPluginsMap'
import DiContainer from 'reactive-di/core/DiContainer'


// implements ProviderManager, ContainerManager
class DefaultProviderManager {
    _annotations: Map<DependencyKey, Annotation>;
    _cache: Map<DependencyKey, Provider>;
    _plugins: Map<string, Plugin>;
    _updater: RelationUpdater;

    middlewares: Map<DependencyKey|Tag, Array<DependencyKey>>;
    _resolverCaches: Array<Map<DependencyKey, Resolver>>;

    constructor(
        config: Array<Annotation> = [],
        plugins: Map<string, Plugin>,
        updater: RelationUpdater
    ) {
        this._annotations = normalizeConfiguration(config)
        this.middlewares = new SimpleMap()
        this._cache = new SimpleMap()
        this._plugins = plugins
        this._updater = updater
        this._resolverCaches = []
    }

    _createProvider(annotatedDep: DependencyKey, context: Context): ?Provider {
        let annotation: ?Annotation = this._annotations.get(annotatedDep);
        if (!annotation) {
            if (!this._parent) {
                annotation = driver.getAnnotation((annotatedDep: Dependency))
                if (!annotation) {
                    return null
                }
            } else {
                return null
            }
        }

        const plugin: ?Plugin = this._plugins.get(annotation.kind);
        if (!plugin) {
            throw new Error(
                `Provider not found for annotation ${getFunctionName(annotation.target)}`
            )
        }

        const provider: Provider = plugin.create(annotation);
        this._updater.begin(provider)
        provider.init(context)
        this._updater.end(provider)

        return provider
    }

    setMiddlewares(
        raw?: Array<[DependencyKey, Array<Tag|DependencyKey>]>
    ): ContainerManager {
        this.middlewares = normalizeMiddlewares(raw || [])
        return this
    }

    createContainer(parent?: Context): Context {
        return new DiContainer((this: ProviderManager), parent)
    }

    addCacheHandler(cache: Map<DependencyKey, Resolver>): void {
        this._resolverCaches.push(cache)
    }

    removeCacheHandler(cache: Map<DependencyKey, Resolver>): void {
        this._resolverCaches = this._resolverCaches.filter((target) => target !== cache)
    }

    replace(annotatedDep: DependencyKey, annotation?: Annotation): void {
        const cache = this._cache
        const provider: ?Provider = cache.get(annotatedDep);
        if (provider) {
            const rc = this._resolverCaches
            const k = rc.length
            const parents = provider.getParents()
            for (let i = 0, l = parents.length; i < l; i++) {
                const target = parents[i].annotation.target
                cache.delete(target)
                for (let j = 0; j < k; j++) {
                    rc[j].delete(target)
                }
            }
        }
        if (annotation) {
            this._annotations.set(annotatedDep, annotation)
        }
    }

    getProvider(annotatedDep: DependencyKey, context: Context): ?Provider {
        let provider: ?Provider = this._cache.get(annotatedDep);
        if (!provider) {
            provider = this._createProvider(annotatedDep, context);
            if (provider) {
                this._cache.set(annotatedDep, provider)
            }
        } else {
            this._updater.inheritRelations(provider)
        }

        return provider
    }
}

export default function createConfigProvider(
    pluginsConfig: Array<Plugin>,
    createUpdater: () => RelationUpdater
): (config?: Array<Annotation>) => ContainerManager {
    const plugins: Map<string, Plugin> = createPluginsMap(pluginsConfig);

    return function createContainerManager(
        config?: Array<Annotation> = []
    ): ContainerManager {
        return new DefaultProviderManager(config, plugins, createUpdater());
    }
}
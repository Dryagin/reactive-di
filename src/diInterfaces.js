/* @flow */

import type {Dependency} from './annotations/annotationInterfaces'
import type {
    AnyDep,
    ClassDep,
    FactoryDep
} from './nodes/nodeInterfaces'

import type {Subscription} from './observableInterfaces'

export type ReactiveDi = {
    subscribe(annotatedDep: Dependency): Subscription;
    get<A: any, E>(annotatedDep: Dependency<A>): A;
}
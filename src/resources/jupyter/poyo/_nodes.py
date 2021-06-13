# -*- coding: utf-8 -*-


class TreeElement(object):
    """Helper class to identify internal classes."""

    def __init__(self, **kwargs):
        pass


class ContainerMixin(object):
    """Mixin that can hold TreeElement instances.

    Containers can be called to return a dict representation.
    """

    def __init__(self, **kwargs):
        self._children = []
        super(ContainerMixin, self).__init__(**kwargs)

    def __iter__(self):
        for c in self._children:
            yield c

    def __call__(self):
        return {c.name: c() for c in self}

    def add_child(self, child):
        """If the given object is an instance of Child add it to self and
        register self as a parent.
        """
        if not isinstance(child, ChildMixin):
            raise TypeError(
                "Requires instance of TreeElement. " "Got {}".format(type(child))
            )
        child.parent = self
        self._children.append(child)


class ChildMixin(object):
    """Mixin that can be attached to Container object."""

    def __init__(self, **kwargs):
        parent = kwargs["parent"]

        if not isinstance(parent, ContainerMixin):
            raise ValueError("Parent of ChildMixin instance needs to be a Container.")
        parent.add_child(self)
        super(ChildMixin, self).__init__(**kwargs)


class Root(ContainerMixin, TreeElement):
    """Pure Container class to represent the root of a YAML config."""

    def __init__(self, **kwargs):
        super(Root, self).__init__(**kwargs)
        self.level = -1


class Section(ContainerMixin, ChildMixin, TreeElement):
    """Class that can act as a Child, but also as a Container."""

    def __init__(self, name, level, **kwargs):
        super(Section, self).__init__(**kwargs)
        self.name = name
        self.level = level

    def __repr__(self):
        return u"<Section name: {name}>".format(name=self.name)


class Simple(ChildMixin, TreeElement):
    """Class that can solely be used as a Child, f.i. simple key value pairs
    in a config.
    """

    def __init__(self, name, level, value, **kwargs):
        super(Simple, self).__init__(**kwargs)
        self.name = name
        self.level = level
        self.value = value

    def __call__(self):
        return self.value

    def __repr__(self):
        return u"<Simple name: {name}, value: {value}>".format(
            name=self.name, value=self.value
        )
